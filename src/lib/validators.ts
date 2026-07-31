import { z } from "zod";
import { LIMITS, ACCEPTED_IMAGE_TYPES } from "./constants";

// -------------------------------------------
// Auth Validators
// -------------------------------------------
export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
});

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// -------------------------------------------
// Workspace Validators
// -------------------------------------------
export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must be at most 100 characters"),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum([
    "admin",
    "event_manager",
    "judge",
    "reviewer",
    "secretary",
    "pro",
    "volunteer",
  ]),
});

// -------------------------------------------
// Event Validators
// -------------------------------------------
export const createEventSchema = z.object({
  name: z
    .string()
    .min(3, "Event name must be at least 3 characters")
    .max(150, "Event name must be at most 150 characters"),
  description: z
    .string()
    .max(5000, "Description must be at most 5000 characters")
    .optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("unlisted"),
  verificationLevel: z.enum(["standard", "advanced"]).default("standard"),
  audienceType: z
    .enum(["public", "students", "faculty", "alumni", "invite_only", "members"])
    .default("public"),
  liveResultsMode: z
    .enum(["hidden", "rankings", "percentages", "vote_counts", "full_leaderboard"])
    .default("hidden"),
});

export const updateEventSchema = createEventSchema.partial();

// -------------------------------------------
// Category Validators
// -------------------------------------------
export const createCategorySchema = z.object({
  name: z
    .string()
    .min(2, "Category name must be at least 2 characters")
    .max(150, "Category name must be at most 150 characters"),
  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .optional(),
  eligibility: z
    .string()
    .max(1000, "Eligibility rules must be at most 1000 characters")
    .optional(),
  maxNomineesPerVoter: z.number().int().min(1).max(10).default(1),
});

// -------------------------------------------
// Nominee Validators
// -------------------------------------------
export const createNomineeSchema = z.object({
  name: z
    .string()
    .min(1, "Nominee name is required")
    .max(
      LIMITS.MAX_NOMINEE_NAME_LENGTH,
      `Name must be at most ${LIMITS.MAX_NOMINEE_NAME_LENGTH} characters`
    ),
  bio: z
    .string()
    .max(2000, "Bio must be at most 2000 characters")
    .optional(),
});

// -------------------------------------------
// Nomination Validators (Public)
// -------------------------------------------
export const submitNominationSchema = z.object({
  nominations: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        nomineeName: z
          .string()
          .max(LIMITS.MAX_NOMINEE_NAME_LENGTH)
          .optional(),
      })
    )
    .min(1, "Please nominate at least one person"),
  suggestedCategory: z
    .string()
    .max(150, "Suggested category must be at most 150 characters")
    .optional(),
});

// -------------------------------------------
// Vote Validators (Public)
// -------------------------------------------
export const submitVotesSchema = z.object({
  votes: z.array(
    z.object({
      categoryId: z.string().uuid(),
      nomineeId: z.string().uuid().nullable(), // null = skipped
      skipped: z.boolean(),
    })
  ),
  verificationToken: z.string().optional(),
});

// -------------------------------------------
// File Upload Validator
// -------------------------------------------
export const fileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => file.size <= LIMITS.MAX_FILE_SIZE_BYTES,
      `File size must be less than ${LIMITS.MAX_FILE_SIZE_MB}MB`
    )
    .refine(
      (file) =>
        (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type),
      "File must be PNG, JPEG, or WebP"
    ),
});

// -------------------------------------------
// AI Settings Validator
// -------------------------------------------
export const aiSettingsSchema = z.object({
  provider: z.enum(["gemini", "openai", "anthropic"]),
  apiKey: z.string().min(1, "API key is required"),
});

// -------------------------------------------
// Export Types
// -------------------------------------------
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateNomineeInput = z.infer<typeof createNomineeSchema>;
export type SubmitNominationInput = z.infer<typeof submitNominationSchema>;
export type SubmitVotesInput = z.infer<typeof submitVotesSchema>;
export type AISettingsInput = z.infer<typeof aiSettingsSchema>;
