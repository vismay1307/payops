import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const webhookVerification = pgEnum('webhook_verification', [
  'VERIFIED',
  'SIMULATED',
  'FAILED',
]);

export const webhookStatus = pgEnum('webhook_status', [
  'RECEIVED',
  'PROCESSING',
  'PROCESSED',
  'IGNORED',
  'FAILED',
  'DEAD',
]);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Tenant association will be introduced in a later phase.
    orgId: uuid('org_id'),

    paypalEventId: text('paypal_event_id').notNull(),
    eventType: text('event_type').notNull(),
    resourceType: text('resource_type'),
    resourceId: text('resource_id'),

    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),

    verification: webhookVerification('verification').notNull(),

    status: webhookStatus('status').notNull().default('RECEIVED'),

    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),

    eventTime: timestamp('event_time', {
      withTimezone: true,
      mode: 'date',
    }),

    receivedAt: timestamp('received_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),

    processedAt: timestamp('processed_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },
  (table) => [
    uniqueIndex('webhook_events_paypal_event_id_uq').on(table.paypalEventId),
    index('webhook_events_status_received_idx').on(table.status, table.receivedAt),
  ],
);
