import { NextResponse } from 'next/server';
import { runScan, isScanning } from '@/lib/scanner/engine';

export async function POST() {
  if (isScanning()) {
    return NextResponse.json(
      { success: false, error: 'A scan is already in progress' },
      { status: 409 }
    );
  }

  try {
    // Start scan in background (don't await)
    runScan('manual')
      .then((sessionId) => {
        console.log(`Scan completed: ${sessionId}`);
      })
      .catch((error) => {
        console.error('Scan failed:', error);
      });

    return NextResponse.json({
      success: true,
      data: { message: 'Scan started' },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to start scan' },
      { status: 500 }
    );
  }
}
