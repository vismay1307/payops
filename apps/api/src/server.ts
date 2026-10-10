import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDbPool } from './db/db.js';
import { logger } from './lib/logger.js';
import 'dotenv/config';
const env = loadEnv();

const db = createDbPool(env);

const app = createApp({
  env,
  db,
});

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
    },
    'PayOps API server started',
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  server.close(async () => {
    await db.end();

    logger.info('PayOps API server stopped');

    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
