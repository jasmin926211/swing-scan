import { NextResponse } from 'next/server';
import { getScanHistory } from '@/lib/scanner/engine';

export async function GET() {
  try {
    const history = await getScanHistory();
    return NextResponse.json({ success: true, data: history });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scan history' },
      { status: 500 }
    );
  }
}
