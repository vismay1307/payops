import { describe, expect, it } from 'vitest';
import type {
  PayPalHttp,
  PayPalResponse,
  RequestOptions,
} from '../../src/integrations/paypal/http.js';
import { createInvoicesRead } from '../../src/integrations/paypal/invoices.read.js';
import {
  buildDraftBody,
  createInvoicesWrite,
} from '../../src/integrations/paypal/invoices.write.js';

function fakeHttp(handler: (opts: RequestOptions) => PayPalResponse) {
  const calls: RequestOptions[] = [];

  const http: PayPalHttp = {
    request: async (opts) => {
      calls.push(opts);
      return handler(opts);
    },
  };

  return { http, calls };
}

const ok = (body: unknown, status = 200): PayPalResponse => ({
  status,
  body,
  debugId: 'test-debug-id',
});

const input = {
  invoiceNumber: 'PAYOPS-TEST1',
  currency: 'USD',
  recipientEmail: 'buyer@example.com',
  items: [{ name: 'Pro plan', unitAmountMinor: 124000 }],
  invoiceDate: '2026-10-09',
};

const invoice = {
  id: 'INV2-1',
  status: 'SENT',
  detail: {
    currency_code: 'USD',
    invoice_number: 'PAYOPS-TEST1',
    metadata: {
      recipient_view_url: 'https://example.com/invoice',
    },
  },
  amount: {
    currency_code: 'USD',
    value: '1240.00',
  },
  someFutureField: true,
};

describe('buildDraftBody', () => {
  it('formats money using integer minor units', () => {
    const body = buildDraftBody(input) as {
      items: Array<{
        unit_amount: { value: string };
        quantity: string;
      }>;
    };

    expect(body.items[0]!.unit_amount.value).toBe('1240.00');
    expect(body.items[0]!.quantity).toBe('1');
  });

  it('defaults to NET_10 and supports a specified due date', () => {
    const defaultBody = buildDraftBody(input) as {
      detail: { payment_term: unknown };
    };

    expect(defaultBody.detail.payment_term).toEqual({
      term_type: 'NET_10',
    });

    const datedBody = buildDraftBody({
      ...input,
      dueDate: '2026-10-20',
    }) as {
      detail: { payment_term: unknown };
    };

    expect(datedBody.detail.payment_term).toEqual({
      term_type: 'DUE_ON_DATE_SPECIFIED',
      due_date: '2026-10-20',
    });
  });

  it('includes invoicer only when merchant email is provided', () => {
    expect(buildDraftBody(input)).not.toHaveProperty('invoicer');

    expect(
      buildDraftBody({
        ...input,
        merchantEmail: 'merchant@example.com',
      }),
    ).toHaveProperty('invoicer.email_address', 'merchant@example.com');
  });
});

describe('invoices write client', () => {
  it('creates a draft and extracts the invoice ID from the link', async () => {
    const { http, calls } = fakeHttp(() =>
      ok(
        {
          rel: 'self',
          href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-AAAA-BBBB',
          method: 'GET',
        },
        201,
      ),
    );

    const result = await createInvoicesWrite(http).createDraft(input, {
      requestId: 'rid-1',
    });

    expect(result.id).toBe('INV2-AAAA-BBBB');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/v2/invoicing/invoices',
      requestId: 'rid-1',
    });
  });

  it('rejects an invalid create response', async () => {
    const { http } = fakeHttp(() => ok({ unexpected: true }, 201));

    await expect(createInvoicesWrite(http).createDraft(input)).rejects.toThrow();
  });

  it('sends a reminder and reports HTTP 204', async () => {
    const { http, calls } = fakeHttp(() => ({
      status: 204,
      body: undefined,
      debugId: undefined,
    }));

    const result = await createInvoicesWrite(http).remind('INV2-1', {
      subject: 'Reminder',
      note: 'Please pay',
      requestId: 'reminder-1',
    });

    expect(result.status).toBe(204);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/v2/invoicing/invoices/INV2-1/remind',
      requestId: 'reminder-1',
      body: {
        send_to_invoicer: false,
        subject: 'Reminder',
        note: 'Please pay',
      },
    });
  });

  it('sends and cancels invoices through their respective endpoints', async () => {
    const { http, calls } = fakeHttp(() => ok({}));

    const api = createInvoicesWrite(http);

    await api.send('INV2-1');
    await api.cancel('INV2-1');

    expect(calls.map((call) => call.path)).toEqual([
      '/v2/invoicing/invoices/INV2-1/send',
      '/v2/invoicing/invoices/INV2-1/cancel',
    ]);
  });

  it('encodes invoice IDs in action paths', async () => {
    const { http, calls } = fakeHttp(() => ({
      status: 204,
      body: undefined,
      debugId: undefined,
    }));

    await createInvoicesWrite(http).remind('../../x');

    expect(calls[0]!.path).toBe('/v2/invoicing/invoices/..%2F..%2Fx/remind');
  });
});

describe('invoices read client', () => {
  it('gets an invoice and preserves unknown response fields', async () => {
    const { http } = fakeHttp(() => ok(invoice));

    const result = await createInvoicesRead(http).get('INV2-1');

    expect(result.status).toBe('SENT');
    expect(result.detail.metadata?.recipient_view_url).toBe('https://example.com/invoice');
    expect(result).toHaveProperty('someFutureField', true);
  });

  it('rejects a response missing required invoice fields', async () => {
    const { http } = fakeHttp(() => ok({ id: 'INV2-1' }));

    await expect(createInvoicesRead(http).get('INV2-1')).rejects.toThrow();
  });

  it('lists invoices with pagination parameters', async () => {
    const { http, calls } = fakeHttp(() =>
      ok({
        total_items: 1,
        total_pages: 1,
        items: [invoice],
      }),
    );

    const result = await createInvoicesRead(http).list({
      page: 2,
      pageSize: 5,
    });

    expect(calls[0]!.query).toEqual({
      page: 2,
      page_size: 5,
      total_required: true,
    });

    expect(result.items).toHaveLength(1);
  });
});
