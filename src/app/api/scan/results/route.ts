import { NextRequest, NextResponse } from 'next/server';
import { getLatestScanResults } from '@/lib/scanner/engine';
import { PATTERN_DISPLAY_NAMES } from '@/types/pattern';

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    const data = await getLatestScanResults(limit);

    if (!data) {
      return NextResponse.json({
        success: true,
        data: { session: null, results: [] },
      });
    }

    // Enrich with display names
    const enrichedResults = data.results.map((r) => ({
      ...r,
      patternDisplayName: PATTERN_DISPLAY_NAMES[r.patternName] || r.patternName,
    }));

    return NextResponse.json({
      success: true,
      data: {
        session: data.session,
        results: enrichedResults,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}
