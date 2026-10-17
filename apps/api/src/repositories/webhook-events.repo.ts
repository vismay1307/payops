import { desc } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { webhookEvents } from '../db/schema/index.js';

export interface NewWebhookEvent {
  paypalEventId: string;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  payload: Record<string, unknown>;
  verification: 'VERIFIED' | 'SIMULATED' | 'FAILED';
  eventTime: Date | null;
}

/**
 * webhook_events is written before the tenant is known.
 * Tenant association will be introduced in a later phase.
 */
export function createWebhookEventsRepo(db: Db) {
  return {
    /**
     * Inserts a new event.
     * Returns undefined when the PayPal event ID already exists.
     */
    async insertIfNew(event: NewWebhookEvent): Promise<{ id: string } | undefined> {
      const rows = await db
        .insert(webhookEvents)
        .values({
          paypalEventId: event.paypalEventId,
          eventType: event.eventType,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          payload: event.payload,
          verification: event.verification,
          eventTime: event.eventTime,
        })
        .onConflictDoNothing({
          target: webhookEvents.paypalEventId,
        })
        .returning({ id: webhookEvents.id });

      return rows[0];
    },

    async listRecent(limit = 20) {
      return db
        .select({
          id: webhookEvents.id,
          paypalEventId: webhookEvents.paypalEventId,
          eventType: webhookEvents.eventType,
          verification: webhookEvents.verification,
          status: webhookEvents.status,
          receivedAt: webhookEvents.receivedAt,
        })
        .from(webhookEvents)
        .orderBy(desc(webhookEvents.receivedAt))
        .limit(limit);
    },
  };
}
