CREATE TYPE "public"."webhook_status" AS ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED', 'DEAD');--> statement-breakpoint
CREATE TYPE "public"."webhook_verification" AS ENUM('VERIFIED', 'SIMULATED', 'FAILED');--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"paypal_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"payload" jsonb NOT NULL,
	"verification" "webhook_verification" NOT NULL,
	"status" "webhook_status" DEFAULT 'RECEIVED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"event_time" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_paypal_event_id_uq" ON "webhook_events" USING btree ("paypal_event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_status_received_idx" ON "webhook_events" USING btree ("status","received_at");