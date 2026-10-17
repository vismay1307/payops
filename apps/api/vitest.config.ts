import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',

      // Never run integration tests against the development DB.
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',

      // Day 4 integration tests use a separate real PostgreSQL database.
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgres://payops:payops@localhost:5434/payops_test',
    },
  },
});
