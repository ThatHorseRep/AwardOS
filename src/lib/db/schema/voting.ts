import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { verificationMethod, voteSessionStatus, invitationCodeStatus } from './enums';
import { events } from './events';
import { categories, nominees } from './categories';

export const voteSessions = pgTable('vote_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  deviceFingerprint: varchar('device_fingerprint', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 255 }),
  userAgent: text('user_agent'),
  verificationMethod: verificationMethod('verification_method').default('NONE').notNull(),
  verifiedEmail: varchar('verified_email', { length: 255 }),
  invitationCode: varchar('invitation_code', { length: 255 }),
  verificationMetadata: jsonb('verification_metadata').default('{}'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  timeSpentMs: integer('time_spent_ms'),
  categoriesVoted: integer('categories_voted').default(0),
  categoriesSkipped: integer('categories_skipped').default(0),
  scrollEvents: integer('scroll_events'),
  mouseEvents: integer('mouse_events'),
  status: voteSessionStatus('status').default('IN_PROGRESS').notNull(),
}, (table) => ({
  idxEventDevice: index('idx_vote_sessions_event_device').on(table.eventId, table.deviceFingerprint),
  idxEventIpStartedAt: index('idx_vote_sessions_event_ip_started').on(table.eventId, table.ipAddress, table.startedAt),
}));

export const votes = pgTable('votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  voteSessionId: uuid('vote_session_id').notNull().references(() => voteSessions.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  nomineeId: uuid('nominee_id').references(() => nominees.id, { onDelete: 'set null' }),
  skipped: boolean('skipped').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unqVoteSessionCategory: uniqueIndex('unq_vote_session_category').on(table.voteSessionId, table.categoryId),
  idxEventCategoryNominee: index('idx_votes_event_cat_nominee').on(table.eventId, table.categoryId, table.nomineeId),
}));

export const invitationCodes = pgTable('invitation_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 255 }).notNull().unique(),
  status: invitationCodeStatus('status').default('UNUSED').notNull(),
  usedBySession: uuid('used_by_session').references(() => voteSessions.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const voterOtps = pgTable('voter_otps', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verified: boolean('verified').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
