import 'dotenv/config';
import type { RequestHandler } from 'express';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { createDbPool } from './db/db.js';
import { createWebhooksApi, createPayPalClient } from './integrations/paypal/index.js';
import { logger } from './lib/logger.js';
import { createWebhookEventsRepo } from './repositories/webhook-events.repo.js';
import { createWebhookHandler } from './webhooks/handler.js';
import { createSignatureVerifier } from './webhooks/verify.js';

const env = loadEnv();

const dbPool = createDbPool(env);
const db = createDb(dbPool);

let webhookHandler: RequestHandler | undefined;

if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID) {
  const paypalHttp = createPayPalClient({
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    logger,
  });

  const webhooksApi = createWebhooksApi(paypalHttp);
  const verify = createSignatureVerifier(webhooksApi, env.PAYPAL_WEBHOOK_ID);
  const store = createWebhookEventsRepo(db);

  webhookHandler = createWebhookHandler({
    verify,
    store,
    logger,
  });
} else {
  logger.warn(
    {
      paypalCredentialsConfigured: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
      webhookIdConfigured: Boolean(env.PAYPAL_WEBHOOK_ID),
    },
    'PayPal webhook endpoint is not configured; requests will receive 503',
  );
}

const app = createApp({
  env,
  db: dbPool,
  webhookHandler,
});

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(
    {
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      paypalEnv: env.PAYPAL_ENV,
      paypalConfigured: Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET),
      webhookConfigured: Boolean(webhookHandler),
    },
    'payops-api listening',
  );
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');

  server.close(async (error) => {
    if (error) {
      logger.error({ error }, 'Error closing HTTP server');
    }

    try {
      await dbPool.end();
      logger.info('PayOps API server stopped');
      process.exitCode = error ? 1 : 0;
    } catch (poolError) {
      logger.error({ error: poolError }, 'Error closing database pool');
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
