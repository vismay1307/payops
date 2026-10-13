import type { Env } from '../../config/env.js';
import { PayPalError } from './errors.js';
import { assertSandbox, SANDBOX_BASE_URL } from './config.js';

export interface TokenProvider {
  getAccessToken(): Promise<string>;
  invalidateAccessToken(): void;
}

const EXPIRY_BUFFER_MS = 60_000;

export function createTokenProvider(
  env: Pick<Env, 'PAYPAL_CLIENT_ID' | 'PAYPAL_CLIENT_SECRET'>,
  fetchFn: typeof fetch = fetch,
): TokenProvider {
  const baseUrl = SANDBOX_BASE_URL;
  assertSandbox(baseUrl);

  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new PayPalError({
      status: 500,
      code: 'PAYPAL_CREDENTIALS_MISSING',
      message: 'PayPal sandbox client credentials are not configured.',
    });
  }

  let cachedToken: string | undefined;
  let expiresAt = 0;
  let inFlight: Promise<string> | undefined;

  async function requestToken(): Promise<string> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    let response: Response;

    try {
      response = await fetchFn(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new PayPalError({
        status: 503,
        code: 'PAYPAL_OAUTH_NETWORK_ERROR',
        message: 'Unable to reach the PayPal sandbox OAuth endpoint.',
        retriable: true,
      });
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      throw new PayPalError({
        status: response.status,
        code: 'PAYPAL_OAUTH_FAILED',
        message: 'PayPal sandbox OAuth authentication failed.',
        details: payload,
        retriable: response.status === 429 || response.status >= 500,
      });
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('access_token' in payload) ||
      typeof payload.access_token !== 'string' ||
      !('expires_in' in payload) ||
      typeof payload.expires_in !== 'number' ||
      payload.expires_in <= 0
    ) {
      throw new PayPalError({
        status: 502,
        code: 'PAYPAL_OAUTH_INVALID_RESPONSE',
        message: 'PayPal returned an invalid OAuth token response.',
      });
    }

    cachedToken = payload.access_token;
    expiresAt = Date.now() + payload.expires_in * 1000;

    return cachedToken;
  }

  return {
    async getAccessToken(): Promise<string> {
      if (cachedToken && Date.now() < expiresAt - EXPIRY_BUFFER_MS) {
        return cachedToken;
      }

      if (!inFlight) {
        inFlight = requestToken().finally(() => {
          inFlight = undefined;
        });
      }

      return inFlight;
    },

    invalidateAccessToken(): void {
      cachedToken = undefined;
      expiresAt = 0;
    },
  };
}
