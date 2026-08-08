CREATE TYPE "public"."ai_message_role" AS ENUM('USER', 'ASSISTANT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('INFO', 'WARNING', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('VOTE_SPIKE', 'DUPLICATE_FINGERPRINT', 'IP_CLUSTER', 'BOT_BEHAVIOR', 'ABNORMAL_TREND', 'GENERIC');--> statement-breakpoint
CREATE TYPE "public"."audience_type" AS ENUM('PUBLIC', 'STUDENTS', 'FACULTY', 'ALUMNI', 'INVITE_ONLY', 'MEMBERS');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('EMAIL', 'GOOGLE');--> statement-breakpoint
CREATE TYPE "public"."cleanup_task_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."confidence_tier" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('PUBLIC', 'UNLISTED', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."export_format" AS ENUM('XLSX', 'CSV', 'PDF');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."export_type" AS ENUM('NOMINATIONS_RAW', 'NOMINATIONS_CLEAN', 'VOTES_RAW', 'OFFICIAL_RESULTS', 'ANALYTICS', 'FULL_REPORT');--> statement-breakpoint
CREATE TYPE "public"."invitation_code_status" AS ENUM('UNUSED', 'USED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."live_results_mode" AS ENUM('HIDDEN', 'RANKINGS', 'PERCENTAGES', 'VOTE_COUNTS', 'FULL_LEADERBOARD');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('PENDING', 'ACTIVE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."merge_suggestion_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'UNDONE');--> statement-breakpoint
CREATE TYPE "public"."nominee_source" AS ENUM('NOMINATION', 'MANUAL', 'AI_SUGGESTED');--> statement-breakpoint
CREATE TYPE "public"."nominee_status" AS ENUM('ACTIVE', 'MERGED', 'DISQUALIFIED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('SLACK', 'CONSOLE', 'EMAIL', 'WEBHOOK');--> statement-breakpoint
CREATE TYPE "public"."result_action_type" AS ENUM('DISQUALIFY', 'OVERRIDE_RANK', 'REMOVE_VOTES', 'ADD_SPECIAL_AWARD', 'RESTORE', 'PUBLISH', 'UNPUBLISH', 'ADMIN_NOTE');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."suggested_category_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'MERGED');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('STANDARD', 'ADVANCED');--> statement-breakpoint
CREATE TYPE "public"."verification_method" AS ENUM('COOKIE', 'EMAIL_OTP', 'INVITATION_CODE', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."vote_session_status" AS ENUM('IN_PROGRESS', 'SUBMITTED', 'FLAGGED', 'INVALIDATED');--> statement-breakpoint
CREATE TYPE "public"."workflow_stage_type" AS ENUM('CREATION', 'NOMINATIONS', 'SCREENING', 'VERIFICATION', 'ADMIN_REVIEW', 'COMMITTEE_REVIEW', 'JUDGES_SCORING', 'INTERVIEWS', 'SPONSOR_APPROVAL', 'FINAL_REVIEW', 'VOTING', 'OFFICIAL_RESULTS', 'COMMUNITY_ARCHIVE');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('OWNER', 'ADMIN', 'EVENT_MANAGER', 'JUDGE', 'REVIEWER', 'SECRETARY', 'PRO', 'VOLUNTEER');--> statement-breakpoint
CREATE TYPE "public"."workspace_type" AS ENUM('PERSONAL', 'ORGANIZATION');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"display_name" varchar(255) NOT NULL,
	"avatar_url" text,
	"auth_provider" "auth_provider",
	"email_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"deletion_scheduled_for" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"permissions" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255),
	"role" "workspace_role" DEFAULT 'EVENT_MANAGER' NOT NULL,
	"custom_role_id" uuid,
	"token" varchar(255) NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"domain_restrictions" jsonb DEFAULT '[]' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "workspace_role" NOT NULL,
	"custom_role_id" uuid,
	"invited_by" uuid,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"status" "member_status" DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" "workspace_type" NOT NULL,
	"logo_url" text,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"logo_url" text,
	"banner_url" text,
	"flyer_url" text,
	"background_url" text,
	"og_image_url" text,
	"primary_color" varchar(50),
	"secondary_color" varchar(50),
	"accent_color" varchar(50),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_branding_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"visibility" "event_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"verification_level" "verification_level" DEFAULT 'STANDARD' NOT NULL,
	"verification_config" jsonb DEFAULT '{}' NOT NULL,
	"audience_type" "audience_type" DEFAULT 'PUBLIC' NOT NULL,
	"audience_config" jsonb DEFAULT '{}' NOT NULL,
	"live_results_mode" "live_results_mode" DEFAULT 'HIDDEN' NOT NULL,
	"duplicated_from" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"stage_type" "workflow_stage_type" NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"display_order" integer NOT NULL,
	"status" "stage_status" DEFAULT 'PENDING' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"auto_transition" boolean DEFAULT true,
	"config" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"eligibility" text,
	"display_order" integer NOT NULL,
	"max_nominees_per_voter" integer DEFAULT 1,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"nominee_text" text NOT NULL,
	"resolved_nominee_id" uuid,
	"session_id" varchar(255) NOT NULL,
	"device_fingerprint" varchar(255),
	"ip_address" varchar(255),
	"user_agent" text,
	"submission_number" integer DEFAULT 1,
	"is_latest" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nominees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"photo_url" text,
	"bio" text,
	"display_order" integer NOT NULL,
	"status" "nominee_status" DEFAULT 'ACTIVE' NOT NULL,
	"merged_into" uuid,
	"source" "nominee_source" DEFAULT 'NOMINATION' NOT NULL,
	"nomination_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggested_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"suggestion_text" text NOT NULL,
	"status" "suggested_category_status" DEFAULT 'PENDING' NOT NULL,
	"merged_into" uuid,
	"approved_name" varchar(255),
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"session_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" varchar(255) NOT NULL,
	"status" "invitation_code_status" DEFAULT 'UNUSED' NOT NULL,
	"used_by_session" uuid,
	"used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "vote_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"device_fingerprint" varchar(255),
	"ip_address" varchar(255),
	"user_agent" text,
	"verification_method" "verification_method" DEFAULT 'NONE' NOT NULL,
	"verified_email" varchar(255),
	"invitation_code" varchar(255),
	"verification_metadata" jsonb DEFAULT '{}',
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"time_spent_ms" integer,
	"categories_voted" integer DEFAULT 0,
	"categories_skipped" integer DEFAULT 0,
	"scroll_events" integer,
	"mouse_events" integer,
	"status" "vote_session_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	CONSTRAINT "vote_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "voter_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_session_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"nominee_id" uuid,
	"skipped" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cleanup_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"triggered_by" uuid NOT NULL,
	"status" "cleanup_task_status" DEFAULT 'PENDING' NOT NULL,
	"stats" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_merge_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cleanup_task_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"source_nominees" jsonb NOT NULL,
	"suggested_name" varchar(255) NOT NULL,
	"confidence" real NOT NULL,
	"confidence_tier" "confidence_tier" NOT NULL,
	"match_reason" varchar(255) NOT NULL,
	"status" "merge_suggestion_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integrity_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"affected_votes" jsonb,
	"recommendation" text,
	"status" "alert_status" DEFAULT 'NEW' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archive_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"show_winners" boolean DEFAULT true,
	"show_nominees" boolean DEFAULT false,
	"show_statistics" boolean DEFAULT false,
	"show_organizers" boolean DEFAULT false,
	"show_photos" boolean DEFAULT false,
	"show_highlights" boolean DEFAULT false,
	"is_public" boolean DEFAULT true,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "archive_configs_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "official_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"nominee_id" uuid NOT NULL,
	"raw_vote_count" integer NOT NULL,
	"adjusted_vote_count" integer NOT NULL,
	"final_rank" integer NOT NULL,
	"is_winner" boolean DEFAULT false,
	"is_disqualified" boolean DEFAULT false,
	"override_rank" integer,
	"override_reason" text,
	"judge_score" real,
	"composite_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"official_result_id" uuid,
	"action_type" "result_action_type" NOT NULL,
	"description" text NOT NULL,
	"explanation" text,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversible" boolean DEFAULT true,
	"reversed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "special_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"recipient_name" varchar(255) NOT NULL,
	"description" text,
	"photo_url" text,
	"display_order" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"event_id" uuid,
	"actor_id" uuid NOT NULL,
	"action" varchar(255) NOT NULL,
	"target_type" varchar(255),
	"target_id" uuid,
	"details" jsonb,
	"ip_address" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"export_type" "export_type" NOT NULL,
	"format" "export_format" NOT NULL,
	"status" "export_status" DEFAULT 'PENDING' NOT NULL,
	"file_url" varchar(1024),
	"file_size_bytes" integer,
	"row_count" integer,
	"error_message" varchar(1024),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid,
	"event_id" uuid NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"destination_type" varchar(50) NOT NULL,
	"status" "notification_status" NOT NULL,
	"response_code" integer,
	"response_body" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_custom_role_id_custom_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_custom_role_id_custom_roles_id_fk" FOREIGN KEY ("custom_role_id") REFERENCES "public"."custom_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_branding" ADD CONSTRAINT "event_branding_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_resolved_nominee_id_nominees_id_fk" FOREIGN KEY ("resolved_nominee_id") REFERENCES "public"."nominees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_categories" ADD CONSTRAINT "suggested_categories_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggested_categories" ADD CONSTRAINT "suggested_categories_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_used_by_session_vote_sessions_id_fk" FOREIGN KEY ("used_by_session") REFERENCES "public"."vote_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_sessions" ADD CONSTRAINT "vote_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_otps" ADD CONSTRAINT "voter_otps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_vote_session_id_vote_sessions_id_fk" FOREIGN KEY ("vote_session_id") REFERENCES "public"."vote_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_nominee_id_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nominees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cleanup_tasks" ADD CONSTRAINT "ai_cleanup_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cleanup_tasks" ADD CONSTRAINT "ai_cleanup_tasks_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_merge_suggestions" ADD CONSTRAINT "ai_merge_suggestions_cleanup_task_id_ai_cleanup_tasks_id_fk" FOREIGN KEY ("cleanup_task_id") REFERENCES "public"."ai_cleanup_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_merge_suggestions" ADD CONSTRAINT "ai_merge_suggestions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_merge_suggestions" ADD CONSTRAINT "ai_merge_suggestions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_merge_suggestions" ADD CONSTRAINT "ai_merge_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_alerts" ADD CONSTRAINT "integrity_alerts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_alerts" ADD CONSTRAINT "integrity_alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_configs" ADD CONSTRAINT "archive_configs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_configs" ADD CONSTRAINT "archive_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_results" ADD CONSTRAINT "official_results_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_results" ADD CONSTRAINT "official_results_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_results" ADD CONSTRAINT "official_results_nominee_id_nominees_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nominees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_actions" ADD CONSTRAINT "result_actions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_actions" ADD CONSTRAINT "result_actions_official_result_id_official_results_id_fk" FOREIGN KEY ("official_result_id") REFERENCES "public"."official_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_actions" ADD CONSTRAINT "result_actions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_awards" ADD CONSTRAINT "special_awards_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_awards" ADD CONSTRAINT "special_awards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_alert_id_integrity_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."integrity_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_deletion_scheduled_for" ON "users" USING btree ("deletion_scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_workspace_name" ON "custom_roles" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_workspace_user" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_workspace_slug" ON "events" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_event_display_order" ON "workflow_stages" USING btree ("event_id","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_event_category_name" ON "categories" USING btree ("event_id","name");--> statement-breakpoint
CREATE INDEX "idx_categories_event_order" ON "categories" USING btree ("event_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_nominations_session_event_cat" ON "nominations" USING btree ("session_id","event_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_nominees_category_order" ON "nominees" USING btree ("category_id","display_order");--> statement-breakpoint
CREATE INDEX "idx_nominees_normalized_name" ON "nominees" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_vote_sessions_event_device" ON "vote_sessions" USING btree ("event_id","device_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_vote_sessions_event_ip_started" ON "vote_sessions" USING btree ("event_id","ip_address","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_vote_session_category" ON "votes" USING btree ("vote_session_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_votes_event_cat_nominee" ON "votes" USING btree ("event_id","category_id","nominee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_event_category_nominee_res" ON "official_results" USING btree ("event_id","category_id","nominee_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_workspace_created" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_events_event_created" ON "notification_events" USING btree ("event_id","created_at");