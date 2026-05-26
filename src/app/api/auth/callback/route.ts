import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/auth?error=no_code', request.url));
  }

  const clientId = process.env.UPSTOX_CLIENT_ID!;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET!;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/auth?error=token_failed', request.url));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/auth?error=no_token', request.url));
    }

    // Token expires at 3:30 AM IST next day
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24); // Approximate - valid until next 3:30 AM IST

    // Store token
    await prisma.authToken.upsert({
      where: { id: 'singleton' },
      update: {
        accessToken,
        expiresAt,
        clientId,
        clientSecret,
        redirectUri,
      },
      create: {
        id: 'singleton',
        accessToken,
        expiresAt,
        clientId,
        clientSecret,
        redirectUri,
      },
    });

    return NextResponse.redirect(new URL('/auth?success=true', request.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/auth?error=server_error', request.url));
  }
}
