import { pgTable, uuid, varchar, text, boolean, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { nomineeStatus, nomineeSource, suggestedCategoryStatus } from './enums';
import { users } from './users';
import { events } from './events';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  eligibility: text('eligibility'),
  displayOrder: integer('display_order').notNull(),
  maxNomineesPerVoter: integer('max_nominees_per_voter').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unqEventCategoryName: uniqueIndex('unq_event_category_name').on(table.eventId, table.name),
  idxEventDisplayOrder: index('idx_categories_event_order').on(table.eventId, table.displayOrder),
}));

export const nominees = pgTable('nominees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  normalizedName: varchar('normalized_name', { length: 255 }).notNull(),
  photoUrl: text('photo_url'),
  bio: text('bio'),
  displayOrder: integer('display_order').notNull(),
  status: nomineeStatus('status').default('ACTIVE').notNull(),
  mergedInto: uuid('merged_into'), // Self reference, added manually below or in relationships
  source: nomineeSource('source').default('NOMINATION').notNull(),
  nominationCount: integer('nomination_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxCategoryDisplayOrder: index('idx_nominees_category_order').on(table.categoryId, table.displayOrder),
  idxNormalizedName: index('idx_nominees_normalized_name').on(table.normalizedName),
}));

export const nominations = pgTable('nominations', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  nomineeText: text('nominee_text').notNull(),
  resolvedNomineeId: uuid('resolved_nominee_id').references(() => nominees.id, { onDelete: 'set null' }),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: text('user_agent'),
  submissionNumber: integer('submission_number').default(1),
  isLatest: boolean('is_latest').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxSessionEventCategory: index('idx_nominations_session_event_cat').on(table.sessionId, table.eventId, table.categoryId),
}));

export const suggestedCategories = pgTable('suggested_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  suggestionText: text('suggestion_text').notNull(),
  status: suggestedCategoryStatus('status').default('PENDING').notNull(),
  mergedInto: uuid('merged_into'), // Self reference
  approvedName: varchar('approved_name', { length: 255 }),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
