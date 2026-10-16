import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { redactPayPalFixture as redact } from './fixture-redaction.js';
import { logger } from '../src/lib/logger.js';
import { loadEnv } from '../src/config/env.js';
import {
  assertSandbox,
  createPayPalClient,
  createPayPalReadApi,
  SANDBOX_BASE_URL,
} from '../src/integrations/paypal/index.js';
import { createPayPalWriteApi } from '../src/integrations/paypal/write.js';
import type {
  PayPalHttp,
  PayPalResponse,
  RequestOptions,
} from '../src/integrations/paypal/http.js';

dotenv.config({ path: resolve(process.cwd(), '../../.env') });

const fixtureDirectory = resolve(process.cwd(), 'tests/fixtures/paypal');

async function saveFixture(name: string, status: number, body: unknown): Promise<void> {
  await mkdir(fixtureDirectory, { recursive: true });

  const fixture = {
    operation: name,
    status,
    body: redact(body ?? null),
  };

  await writeFile(
    resolve(fixtureDirectory, `${name}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
    'utf8',
  );
}

function identifyOperation(options: RequestOptions): string | undefined {
  if (options.method === 'POST' && options.path === '/v2/invoicing/invoices') {
    return 'invoice-create';
  }

  const actionMatch = options.path.match(/\/v2\/invoicing\/invoices\/[^/]+\/(send|remind|cancel)$/);

  if (options.method === 'POST' && actionMatch) {
    const action = actionMatch[1];

    if (action === 'send') return 'invoice-send';
    if (action === 'remind') return 'invoice-remind';
  }

  if (options.method === 'GET' && /^\/v2\/invoicing\/invoices\/[^/]+$/.test(options.path)) {
    return 'invoice-read';
  }

  return undefined;
}

async function main(): Promise<void> {
  // Require explicit sandbox configuration; never allow a production override.
  if (process.env.PAYPAL_ENV !== 'sandbox') {
    throw new Error('Safety stop: set PAYPAL_ENV=sandbox in the root .env.');
  }

  const env = loadEnv();

  if (
    !env.PAYPAL_CLIENT_ID ||
    !env.PAYPAL_CLIENT_SECRET ||
    !process.env.PAYPAL_BUYER_EMAIL ||
    !process.env.PAYPAL_MERCHANT_EMAIL
  ) {
    throw new Error('Missing PayPal sandbox credentials or buyer/merchant email configuration.');
  }

  assertSandbox(SANDBOX_BASE_URL);

  const baseClient = createPayPalClient({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
  });

  // Capture actual API response bodies without changing the HTTP implementation.
  const capturingHttp: PayPalHttp = {
    async request(options: RequestOptions): Promise<PayPalResponse> {
      const response = await baseClient.request(options);
      const operation = identifyOperation(options);

      if (operation) {
        await saveFixture(operation, response.status, response.body);
        logger.info(`${operation}: HTTP ${response.status}; fixture saved`);
      }

      return response;
    },
  };

  const read = createPayPalReadApi(capturingHttp);
  const write = createPayPalWriteApi(capturingHttp);

  const today = new Date().toISOString().slice(0, 10);
  const invoiceNumber = `PO${Date.now()}`;

  logger.info('PayPal sandbox invoice spike starting.');
  logger.info('No credentials or recipient addresses will be printed.');

  const created = await write.invoices.createDraft(
    {
      invoiceNumber,
      currency: 'USD',
      recipientEmail: process.env.PAYPAL_BUYER_EMAIL,
      merchantEmail: process.env.PAYPAL_MERCHANT_EMAIL,
      invoiceDate: today,
      note: 'PayOps Day 3 sandbox verification invoice.',
      items: [
        {
          name: 'Sandbox integration test',
          description: 'Test invoice only; not a real-world sale.',
          quantity: 1,
          unitAmountMinor: 100,
        },
      ],
    },
    { requestId: randomUUID() },
  );

  logger.info(`Invoice created. ID: ${created.id}`);

  const sent = await write.invoices.send(created.id, {
    requestId: randomUUID(),
    subject: 'PayOps sandbox invoice test',
    note: 'Sandbox integration verification.',
  });

  logger.info(`Invoice send result: HTTP ${sent.status}`);

  const invoice = await read.invoices.get(created.id);

  if (invoice.id !== created.id) {
    throw new Error('Invoice verification failed: returned ID did not match.');
  }

  logger.info(`Invoice read verified. Status: ${invoice.status}`);

  const reminder = await write.invoices.remind(created.id, {
    requestId: randomUUID(),
    note: 'PayOps sandbox reminder verification.',
  });

  logger.info(`Invoice reminder result: HTTP ${reminder.status}`);
  logger.info(`Fixture directory: ${fixtureDirectory}`);
  logger.info('Sandbox invoice spike completed successfully.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';

  // PayPal errors are intentionally not dumped wholesale.
  logger.info(`Sandbox invoice spike failed: ${message}`);
  process.exitCode = 1;
});
