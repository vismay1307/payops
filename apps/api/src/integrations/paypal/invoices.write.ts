import type { PayPalHttp } from './http.js';
import { PayPalError } from './errors.js';
import { createdLinkSchema } from './types.js';
import { formatMoney } from '../../utils/money.js';

export interface DraftInvoiceInput {
  /** Optional invoice number; PayPal allows max 25 characters. */
  invoiceNumber?: string;
  currency: string;
  recipientEmail: string;
  recipientName?: {
    givenName: string;
    surname?: string;
  };
  items: Array<{
    name: string;
    description?: string;
    quantity?: number;
    unitAmountMinor: number;
  }>;
  /** YYYY-MM-DD */
  invoiceDate: string;
  /** YYYY-MM-DD; defaults to NET_10 when omitted. */
  dueDate?: string;
  note?: string;
  /** Sandbox business account email. */
  merchantEmail?: string;
}

export function buildDraftBody(input: DraftInvoiceInput): Record<string, unknown> {
  return {
    detail: {
      ...(input.invoiceNumber ? { invoice_number: input.invoiceNumber } : {}),
      invoice_date: input.invoiceDate,
      currency_code: input.currency,
      ...(input.note ? { note: input.note } : {}),
      payment_term: input.dueDate
        ? {
            term_type: 'DUE_ON_DATE_SPECIFIED',
            due_date: input.dueDate,
          }
        : { term_type: 'NET_10' },
    },
    ...(input.merchantEmail ? { invoicer: { email_address: input.merchantEmail } } : {}),
    primary_recipients: [
      {
        billing_info: {
          ...(input.recipientName
            ? {
                name: {
                  given_name: input.recipientName.givenName,
                  surname: input.recipientName.surname ?? '',
                },
              }
            : {}),
          email_address: input.recipientEmail,
        },
      },
    ],
    items: input.items.map((item) => ({
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      quantity: String(item.quantity ?? 1),
      unit_amount: {
        currency_code: input.currency,
        value: formatMoney(item.unitAmountMinor, input.currency),
      },
    })),
    configuration: {
      allow_tip: false,
      tax_inclusive: false,
    },
  };
}

interface MessageOptions {
  subject?: string;
  note?: string;
  requestId?: string;
}

export function createInvoicesWrite(http: PayPalHttp) {
  const path = (id: string, action: string) =>
    `/v2/invoicing/invoices/${encodeURIComponent(id)}/${action}`;

  async function sendAction(
    id: string,
    action: 'send' | 'remind' | 'cancel',
    opts: MessageOptions = {},
  ): Promise<{ status: number }> {
    const body: Record<string, unknown> = {
      send_to_invoicer: false,
      ...(action === 'send' || action === 'cancel'
        ? { send_to_recipient: action === 'send' || action === 'cancel' }
        : {}),
      ...(opts.subject ? { subject: opts.subject } : {}),
      ...(opts.note ? { note: opts.note } : {}),
    };

    const res = await http.request({
      method: 'POST',
      path: path(id, action),
      body,
      ...(opts.requestId ? { requestId: opts.requestId } : {}),
    });

    return { status: res.status };
  }

  return {
    async createDraft(
      input: DraftInvoiceInput,
      opts: { requestId?: string } = {},
    ): Promise<{ id: string; href: string }> {
      const res = await http.request({
        method: 'POST',
        path: '/v2/invoicing/invoices',
        body: buildDraftBody(input),
        ...(opts.requestId ? { requestId: opts.requestId } : {}),
      });

      const { href } = createdLinkSchema.parse(res.body);
      const id = href.split('/').pop();

      if (!id) {
        throw new PayPalError({
          status: res.status,
          code: 'UNEXPECTED_RESPONSE',
          message: `No invoice id in ${href}`,
        });
      }

      return { id, href };
    },

    async send(id: string, opts: MessageOptions = {}): Promise<{ status: number }> {
      return sendAction(id, 'send', opts);
    },

    /** PayPal allows only two reminders per day. */
    async remind(id: string, opts: MessageOptions = {}): Promise<{ status: number }> {
      return sendAction(id, 'remind', opts);
    },

    async cancel(id: string, opts: MessageOptions = {}): Promise<{ status: number }> {
      return sendAction(id, 'cancel', opts);
    },
  };
}
