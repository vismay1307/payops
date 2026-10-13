import { AppError } from '../../errors/app-error.js';
export const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';

/**
 * Invariant I-04:
 * Refuse to build any PayPal client that is not pointed at sandbox.
 */
export function assertSandbox(baseUrl: string): void {
  if (baseUrl !== SANDBOX_BASE_URL) {
    throw new AppError(
      'INVARIANT_SANDBOX_ONLY',
      500,
      'PayOps only talks to the PayPal sandbox (invariant I-04).',
    );
  }
}
