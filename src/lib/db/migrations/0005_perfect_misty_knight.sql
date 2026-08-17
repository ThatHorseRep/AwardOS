CREATE TABLE "rate_limit_buckets" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "export_jobs" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "export_jobs" WHERE "format" = 'PDF') THEN
		RAISE EXCEPTION 'Cannot replace export_format while legacy PDF jobs exist';
	END IF;
END $$;--> statement-breakpoint
DROP TYPE "public"."export_format";--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('XLSX', 'CSV', 'JSON');--> statement-breakpoint
ALTER TABLE "export_jobs" ALTER COLUMN "format" SET DATA TYPE "public"."export_format" USING "format"::"public"."export_format";--> statement-breakpoint
ALTER TABLE "export_jobs" ADD COLUMN "payload_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD COLUMN "include_sensitive_fields" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_rate_limit_buckets_expires_at" ON "rate_limit_buckets" USING btree ("expires_at");
