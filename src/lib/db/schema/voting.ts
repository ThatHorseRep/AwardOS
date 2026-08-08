import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { verificationMethod, voteSessionStatus, invitationCodeStatus } from './enums';
import { events } from './events';
import { categories, nominees } from './categories';

export const voteSessions = pgTable('vote_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Scoped per event rather than globally unique. A global constraint meant a
  // voter reusing their stored session id in a second event hit a unique
  // violation, surfaced to them as an HTTP 500.
  sessionToken: varchar('session_token', { length: 255 }).notNull(),
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

  unqEventSessionToken: uniqueIndex('unq_vote_sessions_event_token').on(table.eventId, table.sessionToken),

  // One ballot per voter per event, enforced by the database.
  //
  // The application check that used to stand alone here was a read-then-write:
  // under READ COMMITTED two concurrent submissions both saw "no prior ballot"
  // and both committed. A transaction alone does not serialise that — only a
  // constraint to conflict on does. The route now catches 23505 and returns 409.
  //
  // Partial, on two counts: the columns are nullable (a NONE-mode ballot has no
  // email, an OTP ballot may have no fingerprint), and only SUBMITTED sessions
  // represent a cast ballot — abandoned and quarantined sessions must not block
  // a legitimate voter from returning.
  unqEventVerifiedEmail: uniqueIndex('unq_vote_sessions_event_email')
    .on(table.eventId, table.verifiedEmail)
    .where(sql`${table.verifiedEmail} IS NOT NULL AND ${table.status} = 'SUBMITTED'`),
  unqEventFingerprint: uniqueIndex('unq_vote_sessions_event_fingerprint')
    .on(table.eventId, table.deviceFingerprint)
    .where(sql`${table.deviceFingerprint} IS NOT NULL AND ${table.status} = 'SUBMITTED'`),
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
  // SHA-256 of the code, not the code. A leaked backup or a read-only database
  // credential previously handed an attacker every live voting credential.
  codeHash: varchar('code_hash', { length: 64 }).notNull(),
  // Brute force guard. A 6-digit code is 10^6 possibilities, which is trivially
  // searchable when only *sends* are limited and verification attempts are not.
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verified: boolean('verified').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxEventEmail: index('idx_voter_otps_event_email').on(table.eventId, table.email),
}));
