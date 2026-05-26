import { NextRequest, NextResponse } from 'next/server';
import { optimizePortfolio } from '@/lib/portfolio/optimizer';
import { optimizeRequestSchema } from '@/lib/portfolio/validators';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parseResult = optimizeRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues[0].message },
        { status: 400 },
      );
    }

    const result = await optimizePortfolio(parseResult.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to optimize portfolio';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
