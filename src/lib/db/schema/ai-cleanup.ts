import { pgTable, uuid, varchar, timestamp, jsonb, real } from 'drizzle-orm/pg-core';
import { cleanupTaskStatus, confidenceTier, mergeSuggestionStatus } from './enums';
import { users } from './users';
import { events } from './events';
import { categories } from './categories';

export const aiCleanupTasks = pgTable('ai_cleanup_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  triggeredBy: uuid('triggered_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: cleanupTaskStatus('status').default('PENDING').notNull(),
  stats: jsonb('stats'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiMergeSuggestions = pgTable('ai_merge_suggestions', {
  id: uuid('id').defaultRandom().primaryKey(),
  cleanupTaskId: uuid('cleanup_task_id').notNull().references(() => aiCleanupTasks.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  sourceNominees: jsonb('source_nominees').notNull(),
  suggestedName: varchar('suggested_name', { length: 255 }).notNull(),
  confidence: real('confidence').notNull(),
  confidenceTier: confidenceTier('confidence_tier').notNull(),
  matchReason: varchar('match_reason', { length: 255 }).notNull(),
  status: mergeSuggestionStatus('status').default('PENDING').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});
