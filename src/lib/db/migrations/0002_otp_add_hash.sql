ALTER TABLE "voter_otps" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "voter_otps" ADD COLUMN "code_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "voter_otps" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_voter_otps_event_email" ON "voter_otps" USING btree ("event_id","email");