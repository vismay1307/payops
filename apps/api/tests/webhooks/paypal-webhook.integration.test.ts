import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import type { Env } from '../../src/config/env.js';
import { createDb } from '../../src/db/client.js';
import type { DbPool } from '../../src/db/db.js';
import { createWebhookEventsRepo } from '../../src/repositories/webhook-events.repo.js';
import { createWebhookHandler } from '../../src/webhooks/handler.js';
import type { SignatureVerifier } from '../../src/webhooks/verify.js';

const connectionString = process.env.TEST_DATABASE_URL;

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://test:test@localhost:5432/test',
  PAYPAL_ENV: 'sandbox',
  PAYPAL_WEBHOOK_ID: undefined,
};

const headers = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/CERT-TEST',
  'paypal-transmission-id': 'transmission-test-1',
  'paypal-transmission-sig': 'signature-test',
  'paypal-transmission-time': new Date().toISOString(),
};

function makeDb(pool: Pool): DbPool {
  return pool as unknown as DbPool;
}

function eventBody(id: string) {
  return {
    id,
    event_type: 'INVOICING.INVOICE.PAID',
    create_time: new Date().toISOString(),
    resource_type: 'invoice',
    resource: {
      id: 'INV-TEST-123',
      status: 'PAID',
    },
  };
}

describe('PayPal webhook integration', () => {
  let pool: Pool;
  let repo: ReturnType<typeof createWebhookEventsRepo>;
  const eventIds: string[] = [];

  beforeAll(() => {
    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL is required');
    }

    const url = new URL(connectionString);

    if (url.pathname !== '/payops_test') {
      throw new Error('Integration test only permits payops_test');
    }

    pool = new Pool({ connectionString, max: 2 });
    repo = createWebhookEventsRepo(createDb(pool));
  });

  afterAll(async () => {
    if (pool) {
      if (eventIds.length > 0) {
        await pool.query('DELETE FROM webhook_events WHERE paypal_event_id = ANY($1::text[])', [
          eventIds,
        ]);
      }

      await pool.end();
    }
  });

  function makeTestApp(verifyResult: 'SUCCESS' | 'FAILURE' = 'SUCCESS', verifyError = false) {
    const verify: SignatureVerifier = vi.fn(async () => {
      if (verifyError) {
        throw new Error('Simulated verification outage');
      }

      return verifyResult;
    });

    const handler = createWebhookHandler({
      verify,
      store: repo,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as never,
    });

    return { app: createApp({ env: testEnv, db: makeDb(pool), webhookHandler: handler }), verify };
  }

  it('stores a verified event and acknowledges it', async () => {
    const id = `integration-${randomUUID()}`;
    eventIds.push(id);

    const { app, verify } = makeTestApp();
    const rawBody = JSON.stringify(eventBody(id));

    const response = await request(app)
      .post('/api/webhooks/paypal')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true, duplicate: false });
    expect(verify).toHaveBeenCalledOnce();

    const result = await pool.query(
      'SELECT verification, status, event_type FROM webhook_events WHERE paypal_event_id = $1',
      [id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      verification: 'VERIFIED',
      status: 'RECEIVED',
      event_type: 'INVOICING.INVOICE.PAID',
    });
  });

  it('acknowledges duplicate deliveries without inserting a second row', async () => {
    const id = `integration-${randomUUID()}`;
    eventIds.push(id);

    const { app } = makeTestApp();
    const rawBody = JSON.stringify(eventBody(id));

    const first = await request(app)
      .post('/api/webhooks/paypal')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    const second = await request(app)
      .post('/api/webhooks/paypal')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(rawBody);

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true, duplicate: false });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true, duplicate: true });

    const result = await pool.query(
      'SELECT count(*)::int AS count FROM webhook_events WHERE paypal_event_id = $1',
      [id],
    );

    expect(result.rows[0].count).toBe(1);
  });

  it('rejects a failed signature without storing the event', async () => {
    const id = `integration-${randomUUID()}`;
    const { app, verify } = makeTestApp('FAILURE');

    const response = await request(app)
      .post('/api/webhooks/paypal')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(eventBody(id)));

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    expect(verify).toHaveBeenCalledOnce();

    const result = await pool.query(
      'SELECT count(*)::int AS count FROM webhook_events WHERE paypal_event_id = $1',
      [id],
    );

    expect(result.rows[0].count).toBe(0);
  });

  it('returns 503 when signature verification is unavailable', async () => {
    const id = `integration-${randomUUID()}`;
    const { app, verify } = makeTestApp('SUCCESS', true);

    const response = await request(app)
      .post('/api/webhooks/paypal')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(eventBody(id)));

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('VERIFY_UNAVAILABLE');
    expect(verify).toHaveBeenCalledOnce();
  });

  it('rejects requests missing PayPal transmission headers', async () => {
    const { app, verify } = makeTestApp();

    const response = await request(app)
      .post('/api/webhooks/paypal')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(eventBody(`integration-${randomUUID()}`)));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MISSING_HEADERS');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects an unexpected certificate URL', async () => {
    const { app, verify } = makeTestApp();

    const response = await request(app)
      .post('/api/webhooks/paypal')
      .set({ ...headers, 'paypal-cert-url': 'https://attacker.example/cert' })
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(eventBody(`integration-${randomUUID()}`)));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_CERT_URL');
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects stale transmission timestamps', async () => {
    const { app, verify } = makeTestApp();

    const staleHeaders = {
      ...headers,
      'paypal-transmission-time': '2020-01-01T00:00:00.000Z',
    };

    const response = await request(app)
      .post('/api/webhooks/paypal')
      .set(staleHeaders)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(eventBody(`integration-${randomUUID()}`)));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('STALE_EVENT');
    expect(verify).not.toHaveBeenCalled();
  });
});
