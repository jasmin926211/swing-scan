import prisma from '@/lib/prisma';
import { fetchNSEEquityInstruments } from '@/lib/upstox/instruments';

/**
 * Sync all NSE equity instruments from Upstox into the database.
 * Downloads the latest instrument master file, filters for equities,
 * and upserts them into the database.
 */
export async function syncInstruments(): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  const instruments = await fetchNSEEquityInstruments();

  let created = 0;
  let updated = 0;

  // Process in batches of 50 for better performance
  const batchSize = 50;
  for (let i = 0; i < instruments.length; i += batchSize) {
    const batch = instruments.slice(i, i + batchSize);

    const promises = batch.map(async (inst) => {
      const isin = inst.isin!;
      const existing = await prisma.instrument.findUnique({
        where: { isin },
      });

      await prisma.instrument.upsert({
        where: { isin },
        create: {
          instrumentKey: inst.instrument_key,
          tradingSymbol: inst.trading_symbol,
          companyName: inst.name || inst.short_name || inst.trading_symbol,
          isin,
          exchange: 'NSE',
          sector: null,
          isNifty500: true,
          isActive: true,
        },
        update: {
          instrumentKey: inst.instrument_key,
          tradingSymbol: inst.trading_symbol,
          companyName: inst.name || inst.short_name || inst.trading_symbol,
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

    if ((i + batchSize) % 500 === 0 || i + batchSize >= instruments.length) {
      console.log(`Sync progress: ${Math.min(i + batchSize, instruments.length)}/${instruments.length}`);
    }
  }

  console.log(
    `Instrument sync complete: ${created} created, ${updated} updated, ${instruments.length} total`
  );

  return { created, updated, total: instruments.length };
}

/**
 * Get all active instruments from the database.
 */
export async function getActiveInstruments() {
  return prisma.instrument.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      tradingSymbol: 'asc',
    },
  });
}
