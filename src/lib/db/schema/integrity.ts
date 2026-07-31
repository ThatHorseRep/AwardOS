import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { alertType, alertSeverity, alertStatus } from './enums';
import { users } from './users';
import { events } from './events';

export const integrityAlerts = pgTable('integrity_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  alertType: alertType('alert_type').notNull(),
  severity: alertSeverity('severity').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  affectedVotes: jsonb('affected_votes'),
  recommendation: text('recommendation'),
  status: alertStatus('status').default('NEW').notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
