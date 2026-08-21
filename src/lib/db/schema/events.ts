import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { eventStatus, eventVisibility, verificationLevel, audienceType, liveResultsMode, workflowStageType, stageStatus } from './enums';
import { users } from './users';
import { workspaces } from './workspaces';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  status: eventStatus('status').default('DRAFT').notNull(),
  visibility: eventVisibility('visibility').default('PRIVATE').notNull(),
  verificationLevel: verificationLevel('verification_level').default('STANDARD').notNull(),
  verificationConfig: jsonb('verification_config').default('{}').notNull(),
  audienceType: audienceType('audience_type').default('PUBLIC').notNull(),
  audienceConfig: jsonb('audience_config').default('{}').notNull(),
  liveResultsMode: liveResultsMode('live_results_mode').default('HIDDEN').notNull(),
  duplicatedFrom: uuid('duplicated_from'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  unqWorkspaceSlug: uniqueIndex('unq_workspace_slug').on(table.workspaceId, table.slug),
  // Public URLs address events by slug alone, so the public slug namespace is
  // global (migration 0009).
  unqEventSlug: uniqueIndex('unq_event_slug').on(table.slug),
}));

export const eventBranding = pgTable('event_branding', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().unique().references(() => events.id, { onDelete: 'cascade' }),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  flyerUrl: text('flyer_url'),
  backgroundUrl: text('background_url'),
  ogImageUrl: text('og_image_url'),
  primaryColor: varchar('primary_color', { length: 50 }),
  secondaryColor: varchar('secondary_color', { length: 50 }),
  accentColor: varchar('accent_color', { length: 50 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowStages = pgTable('workflow_stages', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  stageType: workflowStageType('stage_type').notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  displayOrder: integer('display_order').notNull(),
  status: stageStatus('status').default('PENDING').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  autoTransition: boolean('auto_transition').default(true),
  config: jsonb('config').default('{}').notNull(),
}, (table) => ({
  unqEventDisplayOrder: uniqueIndex('unq_event_display_order').on(table.eventId, table.displayOrder),
}));
