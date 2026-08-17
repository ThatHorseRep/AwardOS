import { pgTable, uuid, varchar, text, boolean, timestamp, integer, real, uniqueIndex } from 'drizzle-orm/pg-core';
import { resultActionType } from './enums';
import { users } from './users';
import { events } from './events';
import { categories, nominees } from './categories';

export const officialResults = pgTable('official_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  nomineeId: uuid('nominee_id').notNull().references(() => nominees.id, { onDelete: 'cascade' }),
  rawVoteCount: integer('raw_vote_count').notNull(),
  adjustedVoteCount: integer('adjusted_vote_count').notNull(),
  finalRank: integer('final_rank').notNull(),
  isWinner: boolean('is_winner').default(false),
  isDisqualified: boolean('is_disqualified').default(false),
  overrideRank: integer('override_rank'),
  overrideReason: text('override_reason'),
  judgeScore: real('judge_score'),
  compositeScore: real('composite_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unqEventCategoryNomineeResult: uniqueIndex('unq_event_category_nominee_res').on(table.eventId, table.categoryId, table.nomineeId),
}));

export const resultActions = pgTable('result_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  officialResultId: uuid('official_result_id').references(() => officialResults.id, { onDelete: 'cascade' }),
  actionType: resultActionType('action_type').notNull(),
  description: text('description').notNull(),
  explanation: text('explanation'),
  performedBy: uuid('performed_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  performedAt: timestamp('performed_at', { withTimezone: true }).defaultNow().notNull(),
  reversible: boolean('reversible').default(true),
  reversedAt: timestamp('reversed_at', { withTimezone: true }),
});

export const specialAwards = pgTable('special_awards', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  description: text('description'),
  photoUrl: text('photo_url'),
  displayOrder: integer('display_order').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const archiveConfigs = pgTable('archive_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().unique().references(() => events.id, { onDelete: 'cascade' }),
  showWinners: boolean('show_winners').default(true),
  showNominees: boolean('show_nominees').default(false),
  showStatistics: boolean('show_statistics').default(false),
  showOrganizers: boolean('show_organizers').default(false),
  showPhotos: boolean('show_photos').default(false),
  showHighlights: boolean('show_highlights').default(false),
  isPublic: boolean('is_public').default(true),
  updatedBy: uuid('updated_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const nomineePrivacyRequests = pgTable('nominee_privacy_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  nomineeId: uuid('nominee_id').references(() => nominees.id, { onDelete: 'set null' }),
  requesterEmail: varchar('requester_email', { length: 255 }).notNull(),
  requestType: varchar('request_type', { length: 32 }).notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 32 }).default('PENDING').notNull(),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
});
