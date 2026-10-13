const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'HUF', 'TWD']);

function getCurrencyExponent(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Invalid currency code: ${currency}`);
  }

  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
}

/**
 * Converts a decimal money string into integer minor units.
 * Examples: USD "10.25" -> 1025, JPY "100" -> 100.
 */
export function parseMoney(amount: string, currency: string): number {
  const exponent = getCurrencyExponent(currency);
  const pattern = exponent === 0 ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/;

  if (!pattern.test(amount)) {
    throw new Error(`Invalid amount for ${currency}: ${amount}`);
  }

  const [whole = '', fraction = ''] = amount.split('.');
  const minorUnits =
    BigInt(whole) * 10n ** BigInt(exponent) +
    BigInt((fraction + '0'.repeat(exponent)).slice(0, exponent) || '0');

  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Amount exceeds the safe integer range');
  }

  return Number(minorUnits);
}

/**
 * Converts integer minor units into a decimal money string.
 */
export function formatMoney(minorUnits: number, currency: string): string {
  const exponent = getCurrencyExponent(currency);

  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new Error('Minor units must be a non-negative safe integer');
  }

  if (exponent === 0) {
    return String(minorUnits);
  }

  const divisor = 10 ** exponent;
  const whole = Math.floor(minorUnits / divisor);
  const fraction = String(minorUnits % divisor).padStart(exponent, '0');

  return `${whole}.${fraction}`;
}
