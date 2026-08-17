CREATE TABLE IF NOT EXISTS "nominee_privacy_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "nominee_id" uuid REFERENCES "nominees"("id") ON DELETE SET NULL,
  "requester_email" varchar(255) NOT NULL,
  "request_type" varchar(32) NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'PENDING',
  "resolution_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);
