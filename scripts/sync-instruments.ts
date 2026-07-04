import { gunzipSync } from 'zlib';
import { PrismaClient } from '@prisma/client';
import { fetchNifty500Sectors } from '@/lib/upstox/instruments';

const prisma = new PrismaClient();

const NSE_INSTRUMENTS_URL =
  'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';

async function main() {
  console.log('Downloading NSE instrument master from Upstox...');

  // Authoritative sector source (Upstox master has no sector field).
  const nifty500 = await fetchNifty500Sectors();

  const response = await fetch(NSE_INSTRUMENTS_URL);
  if (!response.ok) {
    throw new Error(`Failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const decompressed = gunzipSync(buffer);
  const instruments = JSON.parse(decompressed.toString());

  console.log(`Total NSE instruments downloaded: ${instruments.length}`);

  // Filter for equity only
  const equityInstruments = instruments.filter(
    (inst: any) =>
      inst.segment === 'NSE_EQ' &&
      inst.instrument_type === 'EQ' &&
      inst.isin &&
      inst.trading_symbol
  );

  console.log(`NSE equity instruments to sync: ${equityInstruments.length}`);

  let created = 0;
  let updated = 0;

  // Process in batches
  const batchSize = 50;
  for (let i = 0; i < equityInstruments.length; i += batchSize) {
    const batch = equityInstruments.slice(i, i + batchSize);

    const promises = batch.map(async (inst: any) => {
      const n5 = nifty500.get(inst.isin);
      const sector = n5 ? n5.industry : 'Other';
      const companyName = n5?.company || inst.name || inst.short_name || inst.trading_symbol;

      const existing = await prisma.instrument.findUnique({
        where: { isin: inst.isin },
      });

      await prisma.instrument.upsert({
        where: { isin: inst.isin },
        create: {
          instrumentKey: inst.instrument_key,
          tradingSymbol: inst.trading_symbol,
          companyName,
          isin: inst.isin,
          exchange: 'NSE',
          sector,
          isNifty500: !!n5,
          isActive: true,
        },
        update: {
          instrumentKey: inst.instrument_key,
          tradingSymbol: inst.trading_symbol,
          companyName,
          sector,
          isNifty500: !!n5,
          isActive: true,
        },
      });

      if (existing) {
        updated++;
      } else {
        created++;
      }
    });

    await Promise.all(promises);

    if ((i + batchSize) % 500 === 0 || i + batchSize >= equityInstruments.length) {
      console.log(`Progress: ${Math.min(i + batchSize, equityInstruments.length)}/${equityInstruments.length}`);
    }
  }

  const totalActive = await prisma.instrument.count({ where: { isActive: true } });

  console.log(`\nSync complete: ${created} created, ${updated} updated`);
  console.log(`Total active instruments in DB: ${totalActive}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
