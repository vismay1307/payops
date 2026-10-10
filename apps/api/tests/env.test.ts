import { describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/payops',
    PAYPAL_ENV: 'sandbox',
  };

  it('uses defaults for optional configuration', () => {
    const env = loadEnv(validEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('fails when DATABASE_URL is missing', () => {
    const missingDatabase: Partial<typeof validEnv> = { ...validEnv };
    delete missingDatabase.DATABASE_URL;

    expect(() => loadEnv(missingDatabase)).toThrow(/DATABASE_URL is required/);
  });

  it('rejects PAYPAL_ENV=live', () => {
    expect(() =>
      loadEnv({
        ...validEnv,
        PAYPAL_ENV: 'live',
      }),
    ).toThrow(/PAYPAL_ENV/);
  });

  it('coerces PORT from string to number', () => {
    const env = loadEnv({
      ...validEnv,
      PORT: '4000',
    });

    expect(env.PORT).toBe(4000);
    expect(typeof env.PORT).toBe('number');
  });
});
