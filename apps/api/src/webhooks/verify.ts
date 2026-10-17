import type { IncomingHttpHeaders } from 'node:http';
import type { WebhookSignatureInput } from '../integrations/paypal/index.js';

export interface PayPalWebhookHeaders {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

export type SignatureVerifier = (input: {
  rawEvent: string;
  headers: PayPalWebhookHeaders;
}) => Promise<'SUCCESS' | 'FAILURE'>;

export const MAX_EVENT_AGE_MS = 4 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export function extractPayPalHeaders(
  headers: IncomingHttpHeaders,
): PayPalWebhookHeaders | undefined {
  const authAlgo = first(headers['paypal-auth-algo']);
  const certUrl = first(headers['paypal-cert-url']);
  const transmissionId = first(headers['paypal-transmission-id']);
  const transmissionSig = first(headers['paypal-transmission-sig']);
  const transmissionTime = first(headers['paypal-transmission-time']);

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return undefined;
  }

  return {
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
  };
}

export function isPayPalCertUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' && url.hostname.endsWith('.paypal.com');
  } catch {
    return false;
  }
}

export function isFresh(transmissionTime: string, now = Date.now()): boolean {
  const timestamp = Date.parse(transmissionTime);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const age = now - timestamp;

  return age <= MAX_EVENT_AGE_MS && age >= -MAX_FUTURE_SKEW_MS;
}

export function createSignatureVerifier(
  api: {
    verifySignature(input: WebhookSignatureInput): Promise<'SUCCESS' | 'FAILURE'>;
  },
  webhookId: string,
): SignatureVerifier {
  return ({ rawEvent, headers }) =>
    api.verifySignature({
      ...headers,
      webhookId,
      rawEvent,
    });
}
