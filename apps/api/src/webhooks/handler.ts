import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import { z } from 'zod';

import { AppError } from '../errors/app-error.js';
import type { NewWebhookEvent } from '../repositories/webhook-events.repo.js';
import {
  extractPayPalHeaders,
  isFresh,
  isPayPalCertUrl,
  type SignatureVerifier,
} from './verify.js';

export const eventSchema = z
  .object({
    id: z.string().min(1),
    event_type: z.string().min(1),
    create_time: z.string().optional(),
    resource_type: z.string().optional(),
    resource: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

export function extractResourceId(resource: Record<string, unknown> | undefined): string | null {
  if (!resource) return null;

  const invoice =
    typeof resource.invoice === 'object' && resource.invoice !== null
      ? (resource.invoice as Record<string, unknown>)
      : undefined;

  return (
    str(resource.id) ??
    str(invoice?.id) ??
    str(resource.dispute_id) ??
    str(resource.billing_agreement_id) ??
    null
  );
}

export interface WebhookStore {
  insertIfNew(event: NewWebhookEvent): Promise<{ id: string } | undefined>;
}

export interface WebhookHandlerDeps {
  verify: SignatureVerifier;
  store: WebhookStore;
  logger: Logger;
  now?: () => number;
}

export function createWebhookHandler(deps: WebhookHandlerDeps): RequestHandler {
  const now = deps.now ?? Date.now;

  return async (req, res) => {
    const raw: unknown = req.body;

    if (!Buffer.isBuffer(raw) || raw.length === 0) {
      throw new AppError('EMPTY_BODY', 400, 'Webhook body is empty.');
    }

    const headers = extractPayPalHeaders(req.headers);

    if (!headers) {
      throw new AppError('MISSING_HEADERS', 400, 'Missing PayPal transmission headers.');
    }

    if (!isPayPalCertUrl(headers.certUrl)) {
      throw new AppError('BAD_CERT_URL', 400, 'Unexpected certificate URL.');
    }

    if (!isFresh(headers.transmissionTime, now())) {
      throw new AppError('STALE_EVENT', 400, 'Event is too old or has a future timestamp.');
    }

    const rawEvent = raw.toString('utf8');

    let json: unknown;

    try {
      json = JSON.parse(rawEvent);
    } catch {
      throw new AppError('INVALID_JSON', 400, 'Body is not valid JSON.');
    }

    const parsed = eventSchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError('INVALID_EVENT', 400, 'Body is not a PayPal webhook event.');
    }

    const event = parsed.data;

    let verdict: 'SUCCESS' | 'FAILURE';

    try {
      verdict = await deps.verify({ rawEvent, headers });
    } catch (error) {
      deps.logger.error({ err: error, eventId: event.id }, 'webhook.verify_unavailable');

      throw new AppError('VERIFY_UNAVAILABLE', 503, 'Could not verify the event right now.');
    }

    if (verdict !== 'SUCCESS') {
      deps.logger.warn(
        {
          eventId: event.id,
          eventType: event.event_type,
          transmissionId: headers.transmissionId,
        },
        'webhook.signature_rejected',
      );

      throw new AppError('INVALID_SIGNATURE', 401, 'Signature verification failed.');
    }

    const created = event.create_time ? new Date(event.create_time) : undefined;

    let stored: { id: string } | undefined;

    try {
      stored = await deps.store.insertIfNew({
        paypalEventId: event.id,
        eventType: event.event_type,
        resourceType: event.resource_type ?? null,
        resourceId: extractResourceId(event.resource),
        payload: json as Record<string, unknown>,
        verification: 'VERIFIED',
        eventTime: created && !Number.isNaN(created.getTime()) ? created : null,
      });
    } catch (error) {
      deps.logger.error({ err: error, eventId: event.id }, 'webhook.store_failed');

      throw new AppError('STORE_UNAVAILABLE', 503, 'Could not store the event right now.');
    }

    const duplicate = !stored;

    deps.logger.info(
      {
        eventId: event.id,
        eventType: event.event_type,
        resourceId: extractResourceId(event.resource),
        duplicate,
      },
      duplicate ? 'webhook.duplicate' : 'webhook.stored',
    );

    res.status(200).json({ received: true, duplicate });
  };
}
