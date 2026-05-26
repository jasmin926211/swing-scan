import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Find the most recent scan session
    const session = await prisma.scanSession.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        totalStocks: session.totalStocks,
        scannedCount: session.scannedCount,
        errorCount: session.errorCount,
        patternsFound: session.patternsFound,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Failed to fetch scan status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scan status' },
      { status: 500 }
    );
  }
}
