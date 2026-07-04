import prisma from '@/lib/prisma';
import { fetchNSEEquityInstruments, fetchNifty500Sectors } from '@/lib/upstox/instruments';

/**
 * Sync all NSE equity instruments from Upstox into the database.
 * Downloads the latest instrument master file, filters for equities, and upserts
 * them — populating the correct sector (from the NSE Nifty-500 list) and the
 * isNifty500 flag. Non-Nifty-500 equities get sector "Other".
 */
export async function syncInstruments(): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  const [instruments, nifty500] = await Promise.all([
    fetchNSEEquityInstruments(),
    fetchNifty500Sectors(),
  ]);

  let created = 0;
  let updated = 0;

  // Process in batches of 50 for better performance
  const batchSize = 50;
  for (let i = 0; i < instruments.length; i += batchSize) {
    const batch = instruments.slice(i, i + batchSize);

    const promises = batch.map(async (inst) => {
      const isin = inst.isin!;
      const n5 = nifty500.get(isin);
      const sector = n5 ? n5.industry : 'Other';
      const companyName = n5?.company || inst.name || inst.short_name || inst.trading_symbol;

      const existing = await prisma.instrument.findUnique({
        where: { isin },
      });

      await prisma.instrument.upsert({
        where: { isin },
        create: {
          instrumentKey: inst.instrument_key,
          tradingSymbol: inst.trading_symbol,
          companyName,
          isin,
          exchange: 'NSE',
          sector,
          isNifty500: !!n5,
          isActive: true,
        },
        update: {
          instrumentKey: inst.instrument_key,
          tradingSymbol: inst.trading_symbol,
          companyName,
          sector,          // keep sectors correct on every sync
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
