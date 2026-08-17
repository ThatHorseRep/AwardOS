CREATE TABLE "import_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE cascade,
  "requested_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "idempotency_key" varchar(64) NOT NULL,
  "result" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
CREATE UNIQUE INDEX "unq_import_runs_event_key" ON "import_runs" ("event_id", "idempotency_key");
