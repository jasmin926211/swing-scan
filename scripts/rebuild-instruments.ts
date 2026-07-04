/**
 * Rebuild the instrument universe from authoritative internet sources, with correct
 * sectors. FRESH REBUILD: wipes instruments + cached candles + scan history, then
 * reimports every NSE equity, tagging the ~500 Nifty-500 constituents with their real
 * sector (from NSE) and the rest as "Other".
 *
 *   Sources:
 *     • NSE Nifty-500 constituents CSV  → Company Name, Industry (sector), Symbol, ISIN
 *     • Upstox NSE instrument master    → instrument_key for every NSE equity (for API calls)
 *
 * Both sources are downloaded and VALIDATED before anything is deleted, so a bad or
 * partial download can never wipe your database.
 *
 * Run:  npx tsx scripts/rebuild-instruments.ts
 */
import { gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

// --- Load DATABASE_URL from .env (tsx does not auto-load it) ---
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) { process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, ''); break; }
    }
  } catch { /* fall through — Prisma will error clearly if unset */ }
}

const prisma = new PrismaClient();

const NSE_NIFTY500_CSV = 'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv';
const UPSTOX_NSE_MASTER = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

const ISIN_RE = /^IN[A-Z0-9]{10}$/; // e.g. INE466L01038

interface Nifty500Row { company: string; industry: string; symbol: string; isin: string; }

function fail(msg: string): never {
  console.error(`\n❌ ABORTED (no data changed): ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Download + validate the NSE Nifty-500 list (the sector source)
// ---------------------------------------------------------------------------
async function fetchNifty500(): Promise<Map<string, Nifty500Row>> {
  console.log('↓ Downloading NSE Nifty-500 constituents...');
  const res = await fetch(NSE_NIFTY500_CSV, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' } });
  if (!res.ok) fail(`NSE CSV download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);

  const header = lines[0].replace(/\r/g, '');
  if (!/Company Name,Industry,Symbol,Series,ISIN Code/i.test(header)) {
    fail(`Unexpected NSE CSV header: "${header}"`);
  }

  const byIsin = new Map<string, Nifty500Row>();
  for (const line of lines.slice(1)) {
    const p = line.replace(/\r/g, '').split(',');
    if (p.length < 5) continue;
    const isin = p[p.length - 1].trim();
    const symbol = p[p.length - 3].trim();
    const industry = p[p.length - 4].trim();
    const company = p.slice(0, p.length - 4).join(',').trim(); // company names may contain commas
    if (!ISIN_RE.test(isin)) fail(`Malformed ISIN in NSE CSV: "${isin}" (row: ${line})`);
    if (!industry) fail(`Empty industry for ${symbol} in NSE CSV`);
    byIsin.set(isin, { company, industry, symbol, isin });
  }

  // Validation: expect ~500 constituents
  if (byIsin.size < 480 || byIsin.size > 520) {
    fail(`Nifty-500 row count looks wrong: ${byIsin.size} (expected ~500)`);
  }
  const industries = new Set(Array.from(byIsin.values()).map((r) => r.industry));
  console.log(`  ✓ ${byIsin.size} constituents, ${industries.size} distinct sectors`);
  return byIsin;
}

// ---------------------------------------------------------------------------
// 2. Download + validate the Upstox NSE equity master (for instrument_key)
// ---------------------------------------------------------------------------
interface Equity { instrument_key: string; trading_symbol: string; name: string; isin: string; }
async function fetchUpstoxEquities(): Promise<Equity[]> {
  console.log('↓ Downloading Upstox NSE instrument master...');
  const res = await fetch(UPSTOX_NSE_MASTER);
  if (!res.ok) fail(`Upstox master download failed: ${res.status} ${res.statusText}`);
  const raw = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString());
  if (!Array.isArray(raw)) fail('Upstox master is not an array');

  const equities: Equity[] = raw
    .filter((i: Record<string, unknown>) =>
      i.segment === 'NSE_EQ' && i.instrument_type === 'EQ' && i.isin && i.trading_symbol && i.instrument_key)
    .map((i: Record<string, unknown>) => ({
      instrument_key: i.instrument_key as string,
      trading_symbol: i.trading_symbol as string,
      name: (i.name as string) || (i.short_name as string) || (i.trading_symbol as string),
      isin: i.isin as string,
    }));

  // Validation: NSE has ~2000+ listed equities
  if (equities.length < 1000) fail(`Upstox equity count looks wrong: ${equities.length} (expected 1000+)`);
  // Dedupe by ISIN (some ISINs can appear twice, e.g. multiple series) — keep first EQ.
  const seen = new Set<string>();
  const deduped = equities.filter((e) => (ISIN_RE.test(e.isin) && !seen.has(e.isin) ? (seen.add(e.isin), true) : false));
  console.log(`  ✓ ${deduped.length} unique NSE equities (from ${equities.length} rows)`);
  return deduped;
}

async function main() {
  // ----- Fetch & validate BOTH sources before touching the DB -----
  const nifty500 = await fetchNifty500();
  const equities = await fetchUpstoxEquities();

  // Coverage check: how many Nifty-500 ISINs exist in the Upstox master?
  const matched = Array.from(nifty500.keys()).filter((isin) => equities.some((e) => e.isin === isin)).length;
  console.log(`  ✓ Nifty-500 ↔ Upstox match: ${matched}/${nifty500.size}`);
  if (matched < nifty500.size * 0.9) fail(`Only ${matched}/${nifty500.size} Nifty-500 stocks mapped to Upstox — mapping looks broken`);

  // Truthfulness spot-check: known stocks must carry a real (non-Other) sector.
  const spotChecks = ['RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'SUNPHARMA'];
  const bySymbol = new Map(Array.from(nifty500.values()).map((r) => [r.symbol, r]));
  for (const sym of spotChecks) {
    const row = bySymbol.get(sym);
    if (!row) fail(`Sanity check failed: ${sym} not found in Nifty-500 list`);
    console.log(`  · ${sym} → ${row.industry}`);
  }

  // ----- Build records -----
  const records = equities.map((e) => {
    const n5 = nifty500.get(e.isin);
    return {
      instrumentKey: e.instrument_key,
      tradingSymbol: e.trading_symbol,
      companyName: n5?.company || e.name,
      isin: e.isin,
      exchange: 'NSE',
      sector: n5 ? n5.industry : 'Other',
      isNifty500: !!n5,
      isActive: true,
    };
  });
  const withSector = records.filter((r) => r.sector !== 'Other').length;
  console.log(`\nPrepared ${records.length} instruments (${withSector} with real sector, ${records.length - withSector} = "Other")`);

  // ----- FRESH REBUILD: wipe dependents then instruments -----
  console.log('\n⚠ Wiping cached candles, scan history, and instruments...');
  await prisma.cachedCandle.deleteMany({});
  await prisma.scanSession.deleteMany({}); // cascades scanResult
  await prisma.instrument.deleteMany({});

  // ----- Insert fresh -----
  const batchSize = 200;
  for (let i = 0; i < records.length; i += batchSize) {
    await prisma.instrument.createMany({ data: records.slice(i, i + batchSize), skipDuplicates: true });
  }

  // ----- Post-rebuild validation -----
  const total = await prisma.instrument.count();
  const active = await prisma.instrument.count({ where: { isActive: true } });
  const n500 = await prisma.instrument.count({ where: { isNifty500: true } });
  const realSector = await prisma.instrument.count({ where: { NOT: { sector: 'Other' } } });
  console.log(`\n✓ REBUILD COMPLETE`);
  console.log(`  total: ${total} | active: ${active} | isNifty500: ${n500} | with real sector: ${realSector}`);

  // Verify the spot-check stocks landed with correct sectors in the DB.
  for (const sym of spotChecks) {
    const inst = await prisma.instrument.findFirst({ where: { tradingSymbol: sym } });
    console.log(`  · ${sym}: sector="${inst?.sector}" nifty500=${inst?.isNifty500} key=${inst?.instrumentKey ? 'ok' : 'MISSING'}`);
  }
  if (total !== records.length) console.warn(`  ⚠ inserted ${total} but prepared ${records.length} (possible duplicate ISINs skipped)`);

  await prisma.$disconnect();
  console.log('\nDone. Re-run a scan to populate fresh signals.');
}

main().catch(async (err) => {
  console.error('Rebuild failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
