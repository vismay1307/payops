import { describe, expect, it, vi } from 'vitest';
import type { TokenProvider } from '../../src/integrations/paypal/auth.js';
import { SANDBOX_BASE_URL } from '../../src/integrations/paypal/config.js';
import { PayPalError } from '../../src/integrations/paypal/errors.js';
import { createPayPalHttp } from '../../src/integrations/paypal/http.js';

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function setup(responses: Array<Response | Error>) {
  const queue = [...responses];
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let tokenVersion = 1;

  const fetchFn = vi.fn<typeof fetch>(async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });

    const next = queue.shift();

    if (!next) {
      throw new Error('Unexpected additional fetch call');
    }

    if (next instanceof Error) {
      throw next;
    }

    return next;
  });

  const tokens: TokenProvider = {
    getAccessToken: async () => `token-${tokenVersion}`,
    invalidateAccessToken: () => {
      tokenVersion += 1;
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sleep = vi.fn(async (_ms: number) => {});

  const http = createPayPalHttp({
    baseUrl: SANDBOX_BASE_URL,
    tokens,
    fetchFn,
    sleep,
    random: () => 1,
  });

  return { http, calls, fetchFn, sleep };
}

function authorization(call: { init: RequestInit }): string | undefined {
  return (call.init.headers as Record<string, string>).Authorization;
}

describe('PayPal HTTP wrapper', () => {
  it('returns the status, parsed body and debug ID on success', async () => {
    const { http } = setup([
      jsonResponse(200, { id: 'INV-123' }, { 'paypal-debug-id': 'debug-1' }),
    ]);

    await expect(
      http.request({ method: 'GET', path: '/v2/invoicing/invoices/INV-123' }),
    ).resolves.toEqual({
      status: 200,
      body: { id: 'INV-123' },
      debugId: 'debug-1',
    });
  });

  it('supports an empty 204 response', async () => {
    const { http } = setup([new Response(null, { status: 204 })]);

    await expect(
      http.request({ method: 'POST', path: '/v2/example', body: {} }),
    ).resolves.toMatchObject({
      status: 204,
      body: undefined,
    });
  });

  it('adds query parameters and the idempotency request ID', async () => {
    const { http, calls } = setup([jsonResponse(200, {})]);

    await http.request({
      method: 'POST',
      path: '/v2/example',
      query: { page: 2, include: 'details', omitted: undefined },
      body: { amount: '10.00' },
      requestId: 'request-123',
    });

    expect(calls[0]!.url).toBe(`${SANDBOX_BASE_URL}/v2/example?page=2&include=details`);

    const headers = calls[0]!.init.headers as Record<string, string>;

    expect(headers.Authorization).toBe('Bearer token-1');
    expect(headers['PayPal-Request-Id']).toBe('request-123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(calls[0]!.init.body).toBe('{"amount":"10.00"}');
  });

  it('refreshes the token and retries once after a 401', async () => {
    const { http, calls } = setup([
      jsonResponse(401, { name: 'AUTHENTICATION_FAILURE' }),
      jsonResponse(200, { ok: true }),
    ]);

    await http.request({ method: 'GET', path: '/v2/example' });

    expect(calls).toHaveLength(2);
    expect(authorization(calls[0]!)).toBe('Bearer token-1');
    expect(authorization(calls[1]!)).toBe('Bearer token-2');
  });

  it('does not retry indefinitely when the refreshed token also gets a 401', async () => {
    const { http, calls } = setup([jsonResponse(401, {}), jsonResponse(401, {})]);

    await expect(http.request({ method: 'GET', path: '/v2/example' })).rejects.toMatchObject({
      status: 401,
    });

    expect(calls).toHaveLength(2);
  });

  it('retries a 429 and respects Retry-After', async () => {
    const { http, calls, sleep } = setup([
      jsonResponse(429, {}, { 'retry-after': '2' }),
      jsonResponse(200, { ok: true }),
    ]);

    await http.request({
      method: 'POST',
      path: '/v2/example',
      body: {},
    });

    expect(calls).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('retries a transient 503 for GET', async () => {
    const { http, calls } = setup([
      jsonResponse(503, { message: 'Temporary failure' }),
      jsonResponse(200, { ok: true }),
    ]);

    await http.request({ method: 'GET', path: '/v2/example' });

    expect(calls).toHaveLength(2);
  });

  it('does not retry a 503 for a non-idempotent POST', async () => {
    const { http, calls } = setup([jsonResponse(503, { message: 'Temporary failure' })]);

    await expect(
      http.request({
        method: 'POST',
        path: '/v2/example',
        body: {},
      }),
    ).rejects.toBeInstanceOf(PayPalError);

    expect(calls).toHaveLength(1);
  });

  it('does not retry an ordinary 400 client error', async () => {
    const { http, calls } = setup([
      jsonResponse(400, {
        name: 'VALIDATION_ERROR',
        message: 'Invalid payload',
      }),
    ]);

    await expect(http.request({ method: 'GET', path: '/v2/example' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid payload',
    });

    expect(calls).toHaveLength(1);
  });

  it('marks a failed non-idempotent POST outcome as unknown', async () => {
    const { http, calls } = setup([new Error('Connection lost')]);

    await expect(
      http.request({
        method: 'POST',
        path: '/v2/invoicing/invoices',
        body: { detail: [] },
      }),
    ).rejects.toMatchObject({
      code: 'OUTCOME_UNKNOWN',
      status: 0,
    });

    expect(calls).toHaveLength(1);
  });

  it('retries a failed GET after a network error', async () => {
    const { http, calls } = setup([new Error('Connection reset'), jsonResponse(200, { ok: true })]);

    await expect(http.request({ method: 'GET', path: '/v2/example' })).resolves.toMatchObject({
      status: 200,
    });

    expect(calls).toHaveLength(2);
  });

  it('rejects a production PayPal URL', () => {
    const tokens: TokenProvider = {
      getAccessToken: async () => 'token',
      invalidateAccessToken: () => {},
    };

    expect(() =>
      createPayPalHttp({
        baseUrl: 'https://api-m.paypal.com',
        tokens,
      }),
    ).toThrow(/sandbox/i);
  });

  it('rejects paths that could escape the sandbox API base URL', async () => {
    const { http, fetchFn } = setup([]);

    await expect(
      http.request({
        method: 'GET',
        path: '//example.com/unsafe',
      }),
    ).rejects.toThrow(/single slash/i);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
