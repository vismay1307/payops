import type { PayPalHttp } from './http.js';
import { createInvoicesRead } from './invoices.read.js';

/**
 * Read-only PayPal API.
 * Safe to use wherever invoice reads are allowed.
 */
export function createPayPalReadApi(http: PayPalHttp) {
  return {
    invoices: createInvoicesRead(http),
  };
}
