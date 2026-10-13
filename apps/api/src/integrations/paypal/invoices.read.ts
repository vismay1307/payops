import type { PayPalHttp } from './http.js';
import { invoiceListSchema, invoiceSchema, type Invoice, type InvoiceList } from './types.js';

export function createInvoicesRead(http: PayPalHttp) {
  return {
    async get(id: string): Promise<Invoice> {
      const response = await http.request({
        method: 'GET',
        path: `/v2/invoicing/invoices/${encodeURIComponent(id)}`,
      });

      return invoiceSchema.parse(response.body);
    },

    async list(options: { page?: number; pageSize?: number } = {}): Promise<InvoiceList> {
      const response = await http.request({
        method: 'GET',
        path: '/v2/invoicing/invoices',
        query: {
          page: options.page ?? 1,
          page_size: options.pageSize ?? 20,
          total_required: true,
        },
      });

      return invoiceListSchema.parse(response.body);
    },
  };
}
