import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTokenProvider } from '../../src/integrations/paypal/auth.js';

const credentials = {
  PAYPAL_CLIENT_ID: 'sandbox-client-id',
  PAYPAL_CLIENT_SECRET: 'sandbox-client-secret',
};

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PayPal OAuth token provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests and returns an access token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({
        access_token: 'token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );

    const provider = createTokenProvider(credentials, fetchMock);

    await expect(provider.getAccessToken()).resolves.toBe('token-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('grant_type=client_credentials');
  });

  it('reuses a cached token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse({
        access_token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );

    const provider = createTokenProvider(credentials, fetchMock);

    await provider.getAccessToken();
    await provider.getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one OAuth request between concurrent callers', async () => {
    let resolveResponse!: (response: Response) => void;

    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );

    const provider = createTokenProvider(credentials, fetchMock);

    const first = provider.getAccessToken();
    const second = provider.getAccessToken();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(
      mockResponse({
        access_token: 'shared-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token']);
  });

  it('requests a fresh token after invalidation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        mockResponse({
          access_token: 'old-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          access_token: 'new-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );

    const provider = createTokenProvider(credentials, fetchMock);

    await expect(provider.getAccessToken()).resolves.toBe('old-token');
    provider.invalidateAccessToken();
    await expect(provider.getAccessToken()).resolves.toBe('new-token');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects missing credentials', () => {
    expect(() =>
      createTokenProvider({
        PAYPAL_CLIENT_ID: undefined,
        PAYPAL_CLIENT_SECRET: undefined,
      }),
    ).toThrow(/credentials are not configured/i);
  });

  it('normalizes an OAuth HTTP failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockResponse({ error: 'invalid_client' }, 401));

    const provider = createTokenProvider(credentials, fetchMock);

    await expect(provider.getAccessToken()).rejects.toMatchObject({
      code: 'PAYPAL_OAUTH_FAILED',
      status: 401,
      retriable: false,
    });
  });

  it('normalizes network failures', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network detail'));

    const provider = createTokenProvider(credentials, fetchMock);

    await expect(provider.getAccessToken()).rejects.toMatchObject({
      code: 'PAYPAL_OAUTH_NETWORK_ERROR',
      status: 503,
      retriable: true,
    });
  });
});
