import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'UPSTOX_CLIENT_ID not configured' },
      { status: 400 }
    );
  }

  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(authUrl);
}
