import { describe, expect, it } from 'vitest';
import { asRecord, readBody } from '../../src/integrations/paypal/body.js';

describe('readBody', () => {
  it('parses valid JSON', async () => {
    const response = new Response('{"id":"INV-123","status":"DRAFT"}');

    await expect(readBody(response)).resolves.toEqual({
      id: 'INV-123',
      status: 'DRAFT',
    });
  });

  it('returns undefined for an empty response', async () => {
    const response = new Response(null, { status: 204 });

    await expect(readBody(response)).resolves.toBeUndefined();
  });

  it('preserves a short non-JSON response as raw text', async () => {
    const response = new Response('Service unavailable');

    await expect(readBody(response)).resolves.toEqual({
      raw: 'Service unavailable',
    });
  });

  it('limits raw response text to 500 characters', async () => {
    const response = new Response('x'.repeat(600));
    const result = await readBody(response);

    expect(asRecord(result).raw).toBe('x'.repeat(500));
  });
});

describe('asRecord', () => {
  it('returns objects as records', () => {
    expect(asRecord({ id: '123' })).toEqual({ id: '123' });
  });

  it('returns an empty object for null and primitive values', () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord('error')).toEqual({});
    expect(asRecord(42)).toEqual({});
  });
});
