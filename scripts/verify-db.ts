import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) { process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, ''); break; }
    }
  } catch { /* ignore */ }
}

const prisma = new PrismaClient();
(async () => {
  const total = await prisma.instrument.count();
  const n500 = await prisma.instrument.count({ where: { isNifty500: true } });
  const real = await prisma.instrument.count({ where: { NOT: { sector: 'Other' } } });
  const wipro = await prisma.instrument.findFirst({
    where: { tradingSymbol: 'WIPRO' },
    select: { sector: true, isNifty500: true, companyName: true },
  });
  const host = (process.env.DATABASE_URL || '').replace(/\/\/[^@]+@/, '//***@').split('@')[1]?.split('/')[0] ?? '?';
  console.log(`host=${host} | total=${total} | isNifty500=${n500} | realSector=${real} | WIPRO=${JSON.stringify(wipro)}`);
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e.message); await prisma.$disconnect(); process.exit(1); });
