import { z } from 'zod';

const optionalString = () =>
  z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined));
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Invariant I-04: PayOps only ever talks to the PayPal sandbox.
  PAYPAL_ENV: z.literal('sandbox').default('sandbox'),

  PAYPAL_CLIENT_ID: z.string().min(1).optional(),
  PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),

  DATABASE_URL: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'DATABASE_URL is required' : 'DATABASE_URL must be a string',
    })
    .min(1, 'DATABASE_URL is required'),

  RENDER_GIT_COMMIT: z.string().optional(),
  PAYPAL_WEBHOOK_ID: optionalString(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );

    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }

  return parsed.data;
}

/** Parsed once at startup. Only server.ts should import this. */
