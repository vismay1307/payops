import type { Logger } from 'pino';
import type { TokenProvider } from './auth.js';
import { asRecord, readBody } from './body.js';
import { assertSandbox } from './config.js';
import { PayPalError } from './errors.js';

export interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  idempotent?: boolean;
  requestId?: string;
}

export interface PayPalResponse {
  status: number;
  body: unknown;
  debugId: string | undefined;
}

interface HttpDependencies {
  baseUrl: string;
  tokens: TokenProvider;
  logger?: Logger;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  timeoutMs?: number;
  maxRetries?: number;
}

const RETRYABLE_5XX = new Set([500, 502, 503, 504]);

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('PayPal API path must start with a single slash.');
  }

  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(value);

  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

async function normalizeError(response: Response): Promise<PayPalError> {
  const body = asRecord(await readBody(response));

  const stringValue = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;

  return new PayPalError({
    status: response.status,
    code: stringValue(body.name) ?? stringValue(body.error) ?? `HTTP_${response.status}`,
    message:
      stringValue(body.message) ?? stringValue(body.error_description) ?? 'PayPal request failed.',
    debugId: stringValue(body.debug_id) ?? response.headers.get('paypal-debug-id') ?? undefined,
    details: body.details,
    retriable: response.status === 429 || RETRYABLE_5XX.has(response.status),
  });
}

export function createPayPalHttp(deps: HttpDependencies) {
  assertSandbox(deps.baseUrl);

  const fetchFn = deps.fetchFn ?? fetch;
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = deps.random ?? Math.random;
  const timeoutMs = deps.timeoutMs ?? 10_000;
  const maxRetries = deps.maxRetries ?? 3;

  async function request(options: RequestOptions): Promise<PayPalResponse> {
    const idempotent = options.idempotent ?? options.method === 'GET';
    const url = buildUrl(deps.baseUrl, options.path, options.query);
    let refreshedToken = false;

    for (let attempt = 0; ; attempt++) {
      const token = await deps.tokens.getAccessToken();
      const startedAt = Date.now();

      let response: Response;

      try {
        response = await fetchFn(url, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(options.requestId ? { 'PayPal-Request-Id': options.requestId } : {}),
          },
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        if (idempotent && attempt < maxRetries) {
          const delay = Math.round(random() * Math.min(5000, 300 * 2 ** attempt));
          await sleep(delay);
          continue;
        }

        throw new PayPalError({
          status: 0,
          code: idempotent ? 'NETWORK_ERROR' : 'OUTCOME_UNKNOWN',
          message: idempotent
            ? 'PayPal request failed due to a network error or timeout.'
            : 'The outcome of the PayPal write request is unknown.',
          retriable: idempotent,
        });
      }

      const debugId = response.headers.get('paypal-debug-id') ?? undefined;

      deps.logger?.debug(
        {
          method: options.method,
          path: options.path,
          status: response.status,
          attempt,
          debugId,
          durationMs: Date.now() - startedAt,
        },
        'paypal.request',
      );

      if (response.ok) {
        return {
          status: response.status,
          body: await readBody(response),
          debugId,
        };
      }

      if (response.status === 401 && !refreshedToken) {
        refreshedToken = true;
        deps.tokens.invalidateAccessToken();
        continue;
      }

      if (response.status === 429 && attempt < maxRetries) {
        const delay =
          retryAfterMs(response) ?? Math.round(random() * Math.min(5000, 300 * 2 ** attempt));

        await sleep(delay);
        continue;
      }

      if (RETRYABLE_5XX.has(response.status) && idempotent && attempt < maxRetries) {
        const delay = Math.round(random() * Math.min(5000, 300 * 2 ** attempt));
        await sleep(delay);
        continue;
      }

      throw await normalizeError(response);
    }
  }

  return { request };
}
