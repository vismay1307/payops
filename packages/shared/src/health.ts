import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  commit: z.string(),
  uptimeSeconds: z.number(),
  checks: z
    .object({
      database: z.enum(['ok', 'down']),
    })
    .optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
