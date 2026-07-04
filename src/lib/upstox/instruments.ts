import { gunzipSync } from 'zlib';
import type { UpstoxInstrument } from './types';

const NSE_INSTRUMENTS_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

const NSE_NIFTY500_CSV =
  'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv';

export interface Nifty500Entry {
  company: string;
  industry: string; // the official NSE sector classification
  symbol: string;
  isin: string;
}

/**
 * Download the official NSE Nifty-500 constituents list, which is the authoritative
 * source of sector (Industry) classification keyed by ISIN. Upstox's instrument
 * master has NO sector field, so this is required to populate sectors correctly.
 * Returns a Map of ISIN → entry. Throws on a malformed/short download (so a bad
 * fetch never silently wipes sectors).
 */
export async function fetchNifty500Sectors(): Promise<Map<string, Nifty500Entry>> {
  const res = await fetch(NSE_NIFTY500_CSV, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/csv' },
  });
  if (!res.ok) {
    throw new Error(`Failed to download Nifty-500 list: ${res.status} ${res.statusText}`);
  }
  const lines = (await res.text())
    .trim()
    .split('\n')
    .map((l) => l.replace(/\r/g, '').trim())
    .filter(Boolean);

  if (!/Company Name,Industry,Symbol,Series,ISIN Code/i.test(lines[0])) {
    throw new Error(`Unexpected Nifty-500 CSV header: "${lines[0]}"`);
  }

  const map = new Map<string, Nifty500Entry>();
  for (const line of lines.slice(1)) {
    const p = line.split(',');
    if (p.length < 5) continue;
    const isin = p[p.length - 1].trim();
    const symbol = p[p.length - 3].trim();
    const industry = p[p.length - 4].trim();
    const company = p.slice(0, p.length - 4).join(',').trim(); // company names may contain commas
    if (isin && industry) map.set(isin, { company, industry, symbol, isin });
  }

  if (map.size < 480) {
    throw new Error(`Nifty-500 list looks incomplete: ${map.size} rows`);
  }
  console.log(`Nifty-500 sectors loaded: ${map.size} constituents`);
  return map;
}

/**
 * Fetch all NSE equity instruments from Upstox's public instrument master file.
 * Downloads the gzipped JSON, decompresses it, and filters for equity stocks only.
 *
 * @returns Array of UpstoxInstrument objects for NSE equities
 */
export async function fetchNSEEquityInstruments(): Promise<UpstoxInstrument[]> {
  console.log('Downloading NSE instrument master from Upstox...');

  const response = await fetch(NSE_INSTRUMENTS_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to download instrument file: ${response.status} ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const decompressed = gunzipSync(buffer);
  const instruments: UpstoxInstrument[] = JSON.parse(decompressed.toString());

  console.log(`Total NSE instruments downloaded: ${instruments.length}`);

  // Filter for equity segment only (excludes futures, options, index, etc.)
  const equityInstruments = instruments.filter(
    (inst) =>
      inst.segment === 'NSE_EQ' &&
      inst.instrument_type === 'EQ' &&
      inst.isin &&
      inst.trading_symbol
  );

  console.log(`NSE equity instruments: ${equityInstruments.length}`);

  return equityInstruments;
}
