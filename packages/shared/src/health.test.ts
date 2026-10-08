import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      service: 'payops-api',
      commit: 'abc123',
      uptimeSeconds: 42,
      checks: {
        database: 'ok',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid status', () => {
    const result = healthResponseSchema.safeParse({
      status: 'broken',
      service: 'payops-api',
      commit: 'abc123',
      uptimeSeconds: 42,
    });

    expect(result.success).toBe(false);
  });
});
