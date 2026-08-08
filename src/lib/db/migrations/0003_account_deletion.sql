ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_scheduled_for" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_deletion_scheduled_for" ON "users" ("deletion_scheduled_for");
