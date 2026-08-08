import { pgTable, uuid, varchar, timestamp, integer, jsonb, index, text } from 'drizzle-orm/pg-core';
import { exportType, exportFormat, exportStatus, notificationType, notificationStatus } from './enums';
import { users } from './users';
import { events } from './events';
import { workspaces } from './workspaces';
import { integrityAlerts } from './integrity';

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exportType: exportType('export_type').notNull(),
  format: exportFormat('format').notNull(),
  status: exportStatus('status').default('PENDING').notNull(),
  fileUrl: varchar('file_url', { length: 1024 }),
  fileSizeBytes: integer('file_size_bytes'),
  rowCount: integer('row_count'),
  errorMessage: varchar('error_message', { length: 1024 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 255 }).notNull(),
  targetType: varchar('target_type', { length: 255 }),
  targetId: uuid('target_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxWorkspaceCreatedAt: index('idx_audit_logs_workspace_created').on(table.workspaceId, table.createdAt), // DESC usually requires sorting in query but this helps
}));

export const notificationEvents = pgTable('notification_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  alertId: uuid('alert_id').references(() => integrityAlerts.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  notificationType: notificationType('notification_type').notNull(),
  destinationType: varchar('destination_type', { length: 50 }).notNull(),
  status: notificationStatus('status').notNull(),
  responseCode: integer('response_code'),
  responseBody: jsonb('response_body'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  idxNotificationEvent: index('idx_notification_events_event_created').on(table.eventId, table.createdAt),
}));
