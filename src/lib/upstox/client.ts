import { getStoredToken, isTokenValid } from './auth';
import { rateLimitedFetch } from './rate-limiter';

/**
 * Get authorization headers with the stored Bearer token.
 * Throws if no valid token is available.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const valid = await isTokenValid();
  if (!valid) {
    throw new Error(
      'Upstox access token is expired or not found. Please re-authenticate.'
    );
  }

  const token = await getStoredToken();
  if (!token) {
    throw new Error(
      'Upstox access token not found. Please authenticate first.'
    );
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

/**
 * Fetch a URL with Upstox auth headers and rate limiting.
 * Combines authentication and rate limiting into a single call.
 */
async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const authHeaders = await getAuthHeaders();

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...(options?.headers || {}),
    },
  };

  const response = await rateLimitedFetch(url, mergedOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Upstox API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response;
}

/**
 * Singleton Upstox API client.
 * Provides authenticated, rate-limited access to the Upstox API.
 */
const upstoxClient = {
  getAuthHeaders,
  fetchWithAuth,
};

export default upstoxClient;
