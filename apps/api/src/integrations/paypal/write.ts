import type { PayPalHttp } from './http.js';
import { createInvoicesWrite } from './invoices.write.js';

/**
 * PayPal write operations can create, send and cancel invoices.
 * Keep this API restricted to explicitly authorized callers.
 */
export function createPayPalWriteApi(http: PayPalHttp) {
  return {
    invoices: createInvoicesWrite(http),
  };
}
