import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const PG = {
  name: 'pg',
  message: 'Only apps/api/src/db may import pg.',
};

const ORM = {
  name: 'drizzle-orm',
  message: 'Only apps/api/src/db and apps/api/src/repositories may import the ORM.',
};

const ORM_SUB = {
  group: ['drizzle-orm/*'],
  message: 'Only apps/api/src/db and apps/api/src/repositories may import ORM subpaths.',
};

const PAYPAL_WRITE_PATHS = [
  {
    name: './integrations/paypal/write.js',
    message: 'PayPal write operations must only be used by explicitly authorized actions.',
  },
  {
    name: '../integrations/paypal/write.js',
    message: 'PayPal write operations must only be used by explicitly authorized actions.',
  },
  {
    name: '../../integrations/paypal/write.js',
    message: 'PayPal write operations must only be used by explicitly authorized actions.',
  },
];

const PAYPAL_WRITE_PATTERN = {
  group: ['**/integrations/paypal/write.js'],
  message: 'PayPal write operations must only be imported by explicitly authorized actions.',
};

const restrictImports = ({ paths = [], patterns = [] } = {}) => ['error', { paths, patterns }];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/*.tsbuildinfo',
      'scripts/**',
      'apps/api/src/db/migrations/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // General rules for JavaScript and TypeScript files.
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-console': 'error',
    },
  },

  // Only the database layer may import pg.
  // Only db/ and repositories/ may import Drizzle.
  {
    files: ['apps/api/src/**/*.{ts,tsx}'],
    ignores: ['apps/api/src/db/**/*.{ts,tsx}', 'apps/api/src/repositories/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [PG, ORM, ...PAYPAL_WRITE_PATHS],
        patterns: [ORM_SUB, PAYPAL_WRITE_PATTERN],
      }),
    },
  },

  // Database code may use pg and Drizzle, but not PayPal write clients
  // through the restricted import paths.
  {
    files: ['apps/api/src/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: PAYPAL_WRITE_PATHS,
        patterns: [PAYPAL_WRITE_PATTERN],
      }),
    },
  },

  // Repositories may use Drizzle, but may not import pg directly.
  {
    files: ['apps/api/src/repositories/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [PG, ...PAYPAL_WRITE_PATHS],
        patterns: [PAYPAL_WRITE_PATTERN],
      }),
    },
  },

  // Routes must not access the database or PayPal directly.
  {
    files: ['apps/api/src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [PG, ORM, ...PAYPAL_WRITE_PATHS],
        patterns: [
          {
            group: ['**/db/**'],
            message: 'Routes must call controllers/services, not the database directly.',
          },
          {
            group: ['**/repositories/**'],
            message: 'Routes must call controllers/services, not repositories directly.',
          },
          {
            group: ['**/paypal/**'],
            message: 'Routes must not call PayPal directly. Use the service layer.',
          },
          ORM_SUB,
          PAYPAL_WRITE_PATTERN,
        ],
      }),
    },
  },

  // Controllers must call services, not the database or PayPal directly.
  {
    files: ['apps/api/src/controllers/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [PG, ORM, ...PAYPAL_WRITE_PATHS],
        patterns: [
          {
            group: ['**/db/**'],
            message: 'Controllers must call services, not the database directly.',
          },
          {
            group: ['**/repositories/**'],
            message: 'Controllers must call services, not repositories directly.',
          },
          {
            group: ['**/paypal/**'],
            message: 'Controllers must call services, not PayPal directly.',
          },
          ORM_SUB,
          PAYPAL_WRITE_PATTERN,
        ],
      }),
    },
  },

  // PayPal integration files can use the integration layer,
  // but cannot bypass the database/repository boundary with pg or Drizzle.
  {
    files: ['apps/api/src/integrations/paypal/**/*.{ts,tsx}'],
    ignores: ['apps/api/src/integrations/paypal/write.ts'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [PG, ORM, ...PAYPAL_WRITE_PATHS],
        patterns: [ORM_SUB, PAYPAL_WRITE_PATTERN],
      }),
    },
  },

  // Keep the write client itself protected from importing itself.
  {
    files: ['apps/api/src/integrations/paypal/write.ts'],
    rules: {
      'no-restricted-imports': restrictImports({
        paths: [PG, ORM],
        patterns: [ORM_SUB],
      }),
    },
  },

  // The web app uses browser globals.
  {
    files: ['apps/web/**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  // Console output is allowed in scripts and configuration files.
  {
    files: ['scripts/**/*.{js,mjs,cjs,ts,tsx}', '**/*.config.*'],
    rules: {
      'no-console': 'off',
    },
  },
);
