import { pgTable, uuid, varchar, text, timestamp, jsonb, uniqueIndex, integer } from 'drizzle-orm/pg-core';
import { workspaceType, workspaceRole, memberStatus } from './enums';
import { users } from './users';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  type: workspaceType('type').notNull(),
  logoUrl: text('logo_url'),
  description: text('description'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const customRoles = pgTable('custom_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  permissions: jsonb('permissions').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unqWorkspaceName: uniqueIndex('unq_workspace_name').on(table.workspaceId, table.name),
}));

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceRole('role').notNull(),
  customRoleId: uuid('custom_role_id').references(() => customRoles.id, { onDelete: 'set null' }),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  status: memberStatus('status').default('PENDING').notNull(),
}, (table) => ({
  unqWorkspaceUser: uniqueIndex('unq_workspace_user').on(table.workspaceId, table.userId),
}));

export const workspaceInvites = pgTable('workspace_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }),
  role: workspaceRole('role').default('EVENT_MANAGER').notNull(),
  customRoleId: uuid('custom_role_id').references(() => customRoles.id, { onDelete: 'set null' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  maxUses: integer('max_uses').default(1).notNull(),
  usesCount: integer('uses_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  domainRestrictions: jsonb('domain_restrictions').default('[]').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
