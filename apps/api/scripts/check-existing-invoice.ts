import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { createPayPalClient, PayPalError } from '../src/integrations/paypal/index.js';
import { loadEnv } from '../src/config/env.js';

dotenv.config({
  path: resolve(process.cwd(), '.env'),
  override: true,
});

const logger = pino({
  level: 'info',
  redact: {
    paths: [
      'clientId',
      'clientSecret',
      'accessToken',
      'token',
      'authorization',
      'headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});

async function main(): Promise<void> {
  const env = loadEnv();

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal sandbox credentials are not configured.');
  }

  const http = createPayPalClient({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    logger,
  });

  const invoiceId = 'INV2-3L95-ZEYT-39PU-NLUT';

  logger.info({ invoiceId }, 'Checking send endpoint for existing sandbox invoice.');

  const response = await http.request({
    method: 'POST',
    path: `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    requestId: randomUUID(),
    body: {
      send_to_invoicer: false,
      send_to_recipient: true,
    },
  });

  logger.info(
    {
      invoiceId,
      httpStatus: response.status,
      result: 'Send request accepted',
    },
    'PayPal invoice send request completed.',
  );
}

main().catch((error: unknown) => {
  if (error instanceof PayPalError) {
    logger.error(
      {
        httpStatus: error.status,
        code: error.code,
        debugId: error.debugId,
        details: error.details,
        retriable: error.retriable,
      },
      'PayPal invoice send request failed.',
    );
  } else {
    logger.error(
      {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
      'Invoice send diagnostic failed.',
    );
  }

  process.exitCode = 1;
});
