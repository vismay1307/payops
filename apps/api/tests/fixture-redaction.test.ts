import { describe, expect, it } from 'vitest';
import { redactPayPalFixture } from '../scripts/fixture-redaction.js';

describe('redactPayPalFixture', () => {
  it('redacts sensitive credential fields, including camelCase keys', () => {
    const result = redactPayPalFixture({
      authorization: 'Basic secret',
      access_token: 'token-123',
      refreshToken: 'refresh-123',
      clientSecret: 'secret-123',
      clientId: 'client-123',
      password: 'password-123',
      invoice: { id: 'INV-123' },
    });

    expect(result).toEqual({
      authorization: '[REDACTED]',
      access_token: '[REDACTED]',
      refreshToken: '[REDACTED]',
      clientSecret: '[REDACTED]',
      clientId: '[REDACTED]',
      password: '[REDACTED]',
      invoice: { id: 'INV-123' },
    });
  });

  it('redacts emails and bearer tokens inside strings', () => {
    const result = redactPayPalFixture({
      message: 'Invoice sent to buyer@example.com',
      header: 'Bearer abc.def.ghi',
    });

    expect(result).toEqual({
      message: 'Invoice sent to [REDACTED_EMAIL]',
      header: 'Bearer [REDACTED]',
    });
  });

  it('redacts values recursively inside arrays and nested objects', () => {
    const result = redactPayPalFixture([
      { email_address: 'buyer@example.com', access_token: 'secret' },
      ['Contact seller@example.org'],
    ]);

    expect(result).toEqual([
      {
        email_address: '[REDACTED_EMAIL]',
        access_token: '[REDACTED]',
      },
      ['Contact [REDACTED_EMAIL]'],
    ]);
  });

  it('preserves ordinary values and nulls', () => {
    expect(
      redactPayPalFixture({
        id: 'INV-123',
        amount: { currency_code: 'USD', value: '1.00' },
        active: true,
        optional: null,
      }),
    ).toEqual({
      id: 'INV-123',
      amount: { currency_code: 'USD', value: '1.00' },
      active: true,
      optional: null,
    });
  });
});
