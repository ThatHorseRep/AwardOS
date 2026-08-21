-- Public event URLs address events by slug alone ("/e/{slug}"), with no
-- workspace identity in the route. Slug uniqueness was previously scoped per
-- workspace (unq_workspace_slug), which allowed two workspaces to publish the
-- same public link and made every public slug lookup resolve
-- nondeterministically between them. Production data contains no duplicate
-- live slugs, so a single global unique index makes the public namespace
-- deterministic without touching stored rows. Soft-deleted events keep
-- reserving their slug until purged so a restore can never collide.
CREATE UNIQUE INDEX IF NOT EXISTS "unq_event_slug" ON "events" ("slug");
