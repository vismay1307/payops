const SENSITIVE_KEY =
  /authorization|access.?token|refresh.?token|client.?secret|client.?id|password|cookie|api.?key/i;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BEARER_PATTERN = /\bBearer\s+\S+/gi;

export function redactPayPalFixture(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactPayPalFixture);
  }

  if (typeof value === 'string') {
    return value
      .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
      .replace(BEARER_PATTERN, 'Bearer [REDACTED]');
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactPayPalFixture(item);
      }
    }

    return result;
  }

  return value;
}
