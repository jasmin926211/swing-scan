import { NextResponse } from 'next/server';
import { syncInstruments, getActiveInstruments } from '@/lib/instruments/sync';

export const maxDuration = 120; // Allow up to 2 minutes for full NSE sync

export async function POST() {
  try {
    const result = await syncInstruments();
    return NextResponse.json({
      success: true,
      data: {
        created: result.created,
        updated: result.updated,
        total: result.total,
        message: `${result.total} NSE instruments synced (${result.created} new, ${result.updated} updated)`,
      },
    });
  } catch (error) {
    console.error('Instrument sync failed:', error);
    return NextResponse.json(
      { success: false, error: `Sync failed: ${error}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const instruments = await getActiveInstruments();
    return NextResponse.json({
      success: true,
      data: { count: instruments.length, instruments },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch instruments' },
      { status: 500 }
    );
  }
}
