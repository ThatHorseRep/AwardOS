import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { authProvider } from './enums';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // references auth.users in supabase
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: authProvider('auth_provider'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  // Account deletion lifecycle (FR-AUTH-06). A deletion request opens a grace
  // window: `deletionRequestedAt` starts it, `deletionScheduledFor` is when the
  // purge job may run, and `deletedAt` is set only once PII has actually been
  // erased. A row with a request but no `deletedAt` is locked out but restorable.
  deletionRequestedAt: timestamp('deletion_requested_at', { withTimezone: true }),
  deletionScheduledFor: timestamp('deletion_scheduled_for', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  idxDeletionScheduledFor: index('idx_users_deletion_scheduled_for').on(table.deletionScheduledFor),
}));
