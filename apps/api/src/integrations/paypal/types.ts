import { z } from 'zod';

export const moneySchema = z
  .object({
    currency_code: z.string(),
    value: z.string(),
  })
  .passthrough();

export const invoiceSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    detail: z
      .object({
        invoice_number: z.string().optional(),
        invoice_date: z.string().optional(),
        currency_code: z.string(),
        payment_term: z
          .object({
            term_type: z.string().optional(),
            due_date: z.string().optional(),
          })
          .passthrough()
          .optional(),
        metadata: z
          .object({
            create_time: z.string().optional(),
            recipient_view_url: z.string().optional(),
            invoicer_view_url: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    amount: moneySchema.optional(),
    due_amount: moneySchema.optional(),
  })
  .passthrough();

export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceListSchema = z
  .object({
    total_items: z.number().optional(),
    total_pages: z.number().optional(),
    items: z.array(invoiceSchema).optional(),
  })
  .passthrough();

export type InvoiceList = z.infer<typeof invoiceListSchema>;

export const createdLinkSchema = z
  .object({
    href: z.string().min(1),
  })
  .passthrough();
