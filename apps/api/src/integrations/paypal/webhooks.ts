import { z } from 'zod';

import type { PayPalHttp } from './http.js';

const verifyResponseSchema = z
  .object({
    verification_status: z.enum(['SUCCESS', 'FAILURE']),
  })
  .passthrough();

export interface WebhookSignatureInput {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  /** The event body exactly as received, without re-serialization. */
  rawEvent: string;
}

export function createWebhooksApi(http: PayPalHttp) {
  return {
    async verifySignature(input: WebhookSignatureInput): Promise<'SUCCESS' | 'FAILURE'> {
      // Serialize the headers, but preserve the event JSON text exactly.
      const j = JSON.stringify;

      const rawBody =
        `{"auth_algo":${j(input.authAlgo)},` +
        `"cert_url":${j(input.certUrl)},` +
        `"transmission_id":${j(input.transmissionId)},` +
        `"transmission_sig":${j(input.transmissionSig)},` +
        `"transmission_time":${j(input.transmissionTime)},` +
        `"webhook_id":${j(input.webhookId)},` +
        `"webhook_event":${input.rawEvent}}`;

      const response = await http.request({
        method: 'POST',
        path: '/v1/notifications/verify-webhook-signature',
        rawBody,
        idempotent: true,
      });

      return verifyResponseSchema.parse(response.body).verification_status;
    },
  };
}
