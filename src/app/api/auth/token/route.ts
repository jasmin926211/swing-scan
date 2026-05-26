import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const token = await prisma.authToken.findUnique({
      where: { id: 'singleton' },
    });

    if (!token) {
      return NextResponse.json({
        success: true,
        data: { connected: false, expired: true },
      });
    }

    const isExpired = new Date() > new Date(token.expiresAt);

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        expired: isExpired,
        expiresAt: token.expiresAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to check token status' },
      { status: 500 }
    );
  }
}
