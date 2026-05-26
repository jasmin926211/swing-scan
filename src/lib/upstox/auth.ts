import prisma from '@/lib/prisma';
import { addDays, startOfDay, isAfter } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { UpstoxTokenResponse } from './types';

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Calculate the next 3:30 AM IST expiry time.
 * Upstox tokens expire daily at 3:30 AM IST.
 * If it's currently before 3:30 AM IST, expiry is today at 3:30 AM IST.
 * If it's after 3:30 AM IST, expiry is tomorrow at 3:30 AM IST.
 */
function getNextExpiry(): Date {
  const now = new Date();
  const nowIST = toZonedTime(now, IST_TIMEZONE);

  // Get today's 3:30 AM IST
  const todayStart = startOfDay(nowIST);
  const today330AM = new Date(todayStart);
  today330AM.setHours(3, 30, 0, 0);

  // If we're past 3:30 AM IST today, set expiry to tomorrow 3:30 AM IST
  const expiryIST = isAfter(nowIST, today330AM)
    ? addDays(today330AM, 1)
    : today330AM;

  // Convert the IST zoned time back to UTC for storage
  return fromZonedTime(expiryIST, IST_TIMEZONE);
}

/**
 * Retrieve the stored access token from the database.
 * Returns null if no token is stored.
 */
export async function getStoredToken(): Promise<string | null> {
  const authToken = await prisma.authToken.findUnique({
    where: { id: 'singleton' },
  });

  if (!authToken) {
    return null;
  }

  return authToken.accessToken;
}

/**
 * Check if the currently stored token is still valid (not expired).
 */
export async function isTokenValid(): Promise<boolean> {
  const authToken = await prisma.authToken.findUnique({
    where: { id: 'singleton' },
  });

  if (!authToken) {
    return false;
  }

  return isAfter(authToken.expiresAt, new Date());
}

/**
 * Store or update the access token in the database.
 * Sets expiry to the next 3:30 AM IST.
 */
export async function storeToken(
  accessToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<void> {
  const expiresAt = getNextExpiry();

  await prisma.authToken.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      accessToken,
      expiresAt,
      clientId,
      clientSecret,
      redirectUri,
    },
    update: {
      accessToken,
      expiresAt,
      clientId,
      clientSecret,
      redirectUri,
    },
  });
}

/**
 * Build the Upstox OAuth2 authorization URL.
 * The user should be redirected to this URL to authorize the app.
 */
export function getAuthorizationUrl(
  clientId: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  return `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 * POSTs to the Upstox token endpoint with application/x-www-form-urlencoded body.
 * Automatically stores the token on success.
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<UpstoxTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(
    'https://api.upstox.com/v2/login/authorization/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to exchange code for token: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const tokenResponse: UpstoxTokenResponse = await response.json();

  // Store the token for future use
  await storeToken(
    tokenResponse.access_token,
    clientId,
    clientSecret,
    redirectUri
  );

  return tokenResponse;
}
