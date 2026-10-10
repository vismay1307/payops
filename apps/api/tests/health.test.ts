import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';
import type { DbPool } from '../src/db/db.js';

const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 3000,
  LOG_LEVEL: 'error',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/payops',
  PAYPAL_ENV: 'sandbox',
};

function makeDb(query: ReturnType<typeof vi.fn>): DbPool {
  return {
    query,
  } as unknown as DbPool;
}

function makeApp(query: ReturnType<typeof vi.fn>) {
  return createApp({
    env: testEnv,
    db: makeDb(query),
  });
}

describe('health endpoints', () => {
  it('GET /healthz is ok and never touches the database', async () => {
    const query = vi.fn().mockRejectedValue(new Error('db down'));

    const res = await request(makeApp(query)).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'payops-api',
      commit: 'local',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('GET /readyz returns 200 when the database answers', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const res = await request(makeApp(query)).get('/readyz');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: {
        database: 'ok',
      },
    });
    expect(query).toHaveBeenCalledWith('select 1');
  });

  it('GET /readyz returns 503 when the database is down', async () => {
    const query = vi.fn().mockRejectedValue(new Error('database unavailable'));

    const res = await request(makeApp(query)).get('/readyz');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded',
      checks: {
        database: 'down',
      },
    });
  });
});

describe('error handling and request ids', () => {
  it('unknown routes return the standard error shape with a request id', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const res = await request(makeApp(query)).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('reuses a valid incoming x-request-id', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const res = await request(makeApp(query)).get('/healthz').set('x-request-id', 'req_test_12345');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('req_test_12345');
  });

  it('replaces an unsafe incoming x-request-id', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const res = await request(makeApp(query))
      .get('/healthz')
      .set('x-request-id', 'bad id with spaces!');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(res.headers['x-request-id']).not.toBe('bad id with spaces!');
  });
});
