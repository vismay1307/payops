/**
 * Returns undefined for an empty body, parsed JSON for valid JSON,
 * or a truncated raw string when the response is not valid JSON.
 */
export async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();

  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
