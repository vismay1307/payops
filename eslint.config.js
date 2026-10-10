import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
  ignores: [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    "**/*.d.ts",
    "scripts/**",
  ],
},

  eslint.configs.recommended,

  ...tseslint.configs.recommended,

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

  {
    files: ['apps/api/src/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/**'],
              message: 'Routes must call controllers/services, not the database directly.',
            },
            {
              group: ['**/paypal/**'],
              message: 'Routes must not call PayPal directly. Use the service layer.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['apps/api/src/controllers/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/**'],
              message: 'Controllers must call services, not the database directly.',
            },
            {
              group: ['**/paypal/**'],
              message: 'Controllers must call services, not PayPal directly.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['apps/api/src/**/*.{ts,tsx}'],
    ignores: ['apps/api/src/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              message: 'Only the database layer may import pg.',
            },
          ],
        },
      ],
    },
  },
);
