CREATE TYPE "public"."notification_type" AS ENUM('SLACK', 'CONSOLE', 'EMAIL', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "notification_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alert_id" uuid REFERENCES "integrity_alerts"("id") ON DELETE CASCADE,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "notification_type" "notification_type" NOT NULL,
  "destination_type" varchar(50) NOT NULL,
  "status" "notification_status" NOT NULL,
  "response_code" integer,
  "response_body" jsonb,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_notification_events_event_created" ON "notification_events" ("event_id", "created_at");
