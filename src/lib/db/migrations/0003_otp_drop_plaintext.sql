-- Any OTP issued before this migration has only a plaintext `code`, which is
-- about to be dropped, so it can never be verified again. Delete those rows
-- rather than letting SET NOT NULL fail on their null `code_hash`. Codes live
-- 10 minutes, so at most a few in-flight verifications are affected and those
-- voters simply request a new code.
DELETE FROM "voter_otps" WHERE "code_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "voter_otps" ALTER COLUMN "code_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "voter_otps" DROP COLUMN "code";