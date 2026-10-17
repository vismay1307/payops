import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import { createDb } from '../../src/db/client.js';
import { createWebhookEventsRepo } from '../../src/repositories/webhook-events.repo.js';

const connectionString = process.env.TEST_DATABASE_URL;

describe('webhook events repository', () => {
  let pool: Pool;
  let repo: ReturnType<typeof createWebhookEventsRepo>;
  let eventId: string;

  beforeAll(() => {
    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL is required');
    }

    const url = new URL(connectionString);

    if (url.pathname !== '/payops_test') {
      throw new Error('Repository test only permits payops_test');
    }

    pool = new Pool({ connectionString, max: 1 });
    repo = createWebhookEventsRepo(createDb(pool));
    eventId = `repo-test-${crypto.randomUUID()}`;
  });

  afterAll(async () => {
    if (pool) {
      if (eventId) {
        await pool.query('DELETE FROM webhook_events WHERE paypal_event_id = $1', [eventId]);
      }

      await pool.end();
    }
  });

  it('inserts an event once and ignores duplicate deliveries', async () => {
    const event = {
      paypalEventId: eventId,
      eventType: 'TEST.REPOSITORY.EVENT',
      resourceType: 'test',
      resourceId: 'resource-test-1',
      payload: { test: true },
      verification: 'SIMULATED' as const,
      eventTime: new Date(),
    };

    const first = await repo.insertIfNew(event);
    const second = await repo.insertIfNew(event);

    expect(first?.id).toBeTruthy();
    expect(second).toBeUndefined();

    const result = await pool.query(
      'SELECT count(*)::int AS count FROM webhook_events WHERE paypal_event_id = $1',
      [eventId],
    );

    expect(result.rows[0].count).toBe(1);
  });
});
