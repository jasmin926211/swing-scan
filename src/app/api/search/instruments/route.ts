import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ success: true, data: [] });
  }

  const instruments = await prisma.instrument.findMany({
    where: {
      isActive: true,
      OR: [
        { tradingSymbol: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      tradingSymbol: true,
      companyName: true,
      sector: true,
    },
    take: 10,
    orderBy: { tradingSymbol: 'asc' },
  });

  return NextResponse.json({ success: true, data: instruments });
}
