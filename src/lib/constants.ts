// ===========================================
// AwardOS — Application Constants
// ===========================================

export const APP_NAME = "AwardOS";
export const APP_DESCRIPTION =
  "The complete operating system for organizing recognition programs and award events.";

// -------------------------------------------
// Workspace Roles
// -------------------------------------------
export const WORKSPACE_ROLES = [
  "owner",
  "admin",
  "event_manager",
  "judge",
  "reviewer",
  "secretary",
  "pro",
  "volunteer",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  event_manager: "Event Manager",
  judge: "Judge",
  reviewer: "Reviewer",
  secretary: "Secretary",
  pro: "Public Relations Officer",
  volunteer: "Volunteer",
};

// -------------------------------------------
// Event Status
// -------------------------------------------
export const EVENT_STATUSES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

// -------------------------------------------
// Event Visibility
// -------------------------------------------
export const EVENT_VISIBILITIES = ["public", "unlisted", "private"] as const;

export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

// -------------------------------------------
// Verification Levels
// -------------------------------------------
export const VERIFICATION_LEVELS = ["standard", "advanced"] as const;

export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const VERIFICATION_METHODS = [
  "cookie",
  "email_otp",
  "domain_whitelist",
  "invitation_code",
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

// -------------------------------------------
// Audience Types
// -------------------------------------------
export const AUDIENCE_TYPES = [
  "public",
  "students",
  "faculty",
  "alumni",
  "invite_only",
  "members",
] as const;

export type AudienceType = (typeof AUDIENCE_TYPES)[number];

// -------------------------------------------
// Live Results Modes
// -------------------------------------------
export const LIVE_RESULTS_MODES = [
  "hidden",
  "rankings",
  "percentages",
  "vote_counts",
  "full_leaderboard",
] as const;

export type LiveResultsMode = (typeof LIVE_RESULTS_MODES)[number];

// -------------------------------------------
// Workflow Stage Types
// -------------------------------------------
export const WORKFLOW_STAGE_TYPES = [
  "creation",
  "nominations",
  "screening",
  "verification",
  "admin_review",
  "committee_review",
  "judges_scoring",
  "interviews",
  "sponsor_approval",
  "final_review",
  "voting",
  "official_results",
  "community_archive",
] as const;

export type WorkflowStageType = (typeof WORKFLOW_STAGE_TYPES)[number];

export const DEFAULT_WORKFLOW_STAGES: WorkflowStageType[] = [
  "creation",
  "nominations",
  "admin_review",
  "voting",
  "official_results",
  "community_archive",
];

// -------------------------------------------
// AI Providers
// -------------------------------------------
export const AI_PROVIDERS = ["gemini", "openai", "anthropic"] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
};

export const AI_PROVIDER_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-2.0-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

// -------------------------------------------
// Confidence Tiers (AI Merge Suggestions)
// -------------------------------------------
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 60,
} as const;

// -------------------------------------------
// Limits
// -------------------------------------------
export const LIMITS = {
  MAX_FILE_SIZE_MB: 5,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_CATEGORIES_PER_EVENT: 100,
  MAX_NOMINEES_PER_CATEGORY: 500,
  MAX_NOMINEE_NAME_LENGTH: 200,
  MAX_INVITATION_CODES: 10_000,
  GRACE_WINDOW_MINUTES: 15,
  OTP_EXPIRY_MINUTES: 5,
  OTP_MAX_RESENDS: 3,
  VOTE_RATE_LIMIT_PER_HOUR: 3,
  IP_RATE_LIMIT_DEFAULT: 5,
  IP_RATE_WINDOW_MINUTES: 60,
  AI_INTERACTIONS_PER_DAY: 50,
  EXPORT_ASYNC_THRESHOLD_ROWS: 10_000,
} as const;

// -------------------------------------------
// Supabase Storage Buckets
// -------------------------------------------
export const STORAGE_BUCKETS = {
  EVENT_BRANDING: "event-branding",
  NOMINEE_PHOTOS: "nominee-photos",
  EXPORTS: "exports",
} as const;

// -------------------------------------------
// Accepted Image Types
// -------------------------------------------
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
