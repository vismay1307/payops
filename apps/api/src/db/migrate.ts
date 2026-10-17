import 'dotenv/config';

import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { logger } from '../lib/logger.js';

type MigrationTarget = 'test' | 'production';

function getMigrationConfig(): {
  target: MigrationTarget;
  connectionString: string;
} {
  const target = process.env.MIGRATION_TARGET;

  if (target !== 'test' && target !== 'production') {
    throw new Error('MIGRATION_TARGET must be explicitly set to test or production');
  }

  if (target === 'test') {
    const connectionString = process.env.TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error('TEST_DATABASE_URL is required for test migrations');
    }

    const url = new URL(connectionString);

    if (url.pathname !== '/payops_test') {
      throw new Error('Test migrations only permit the payops_test database');
    }

    return { target, connectionString };
  }

  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Production migrations require NODE_ENV=production');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for production migrations');
  }

  const url = new URL(connectionString);

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Production database URL must use PostgreSQL');
  }

  if (url.pathname !== '/payops_r17o') {
    throw new Error('Production migrations only permit the payops_r17o database');
  }

  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('Production migrations cannot target a local database');
  }

  return { target, connectionString };
}

async function main(): Promise<void> {
  const { target, connectionString } = getMigrationConfig();

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const db = drizzle(pool);

    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'src/db/migrations'),
    });

    logger.info({ target }, 'Database migrations completed successfully');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  logger.error(
    {
      errorType: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    },
    'Database migration failed',
  );

  process.exitCode = 1;
});
