import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * An in-process Postgres for integration tests.
 *
 * PGlite rather than a container because this project has no Docker and CI has
 * no database service — and mocking is not an option here: the bugs these tests
 * exist to pin down (double-vote races, unique-constraint enforcement) are
 * concurrency and constraint behaviour, which a mock cannot reproduce.
 *
 * The schema comes from the real baseline migration, so a test passing against
 * a schema that production does not have is impossible by construction.
 */
export type TestDb = PGlite;

const MIGRATIONS_DIR = path.join(process.cwd(), "src/lib/db/migrations");

/**
 * Applies every migration in journal order — not just the baseline. Reading the
 * journal rather than globbing the directory means the test database is built
 * exactly the way production was, so a constraint added in a later migration is
 * present here too.
 */
function migrationFiles(): string[] {
  const journal = JSON.parse(
    fs.readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8")
  ) as { entries: Array<{ tag: string }> };

  return journal.entries.map((e) => path.join(MIGRATIONS_DIR, `${e.tag}.sql`));
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();

  for (const file of migrationFiles()) {
    const sql = fs.readFileSync(file, "utf8");

    // drizzle separates statements with this marker rather than plain `;`,
    // which would split mid-function-body.
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await db.exec(statement);
    }
  }

  return db;
}

/** Wipe all data between tests while keeping the schema. */
export async function truncateAll(db: TestDb): Promise<void> {
  const res = await db.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );
  const tables = res.rows.map((r) => `"${r.tablename}"`).join(", ");
  if (tables) {
    await db.exec(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
}

/**
 * Minimal fixture: a workspace with one published event, one category, and one
 * nominee, wired so a ballot can be cast against it.
 */
export async function seedVotingFixture(
  db: TestDb,
  opts: {
    verificationMethod?: "NONE" | "EMAIL_OTP" | "INVITATION_CODE";
    eventStatus?: string;
    votingStageStatus?: string;
    slug?: string;
  } = {}
) {
  const {
    verificationMethod = "NONE",
    eventStatus = "ACTIVE",
    votingStageStatus = "ACTIVE",
    slug = "test-event",
  } = opts;

  // Unique per call so a single test can seed more than one event.
  const suffix = slug;

  // users.id has no default: it mirrors Supabase's auth.users id, which the
  // app supplies. Tests must do the same.
  const user = await one<{ id: string }>(
    db,
    `INSERT INTO users (id, email, display_name)
     VALUES (gen_random_uuid(), $1, 'Owner') RETURNING id`,
    [`owner+${suffix}@example.com`]
  );

  const workspace = await one<{ id: string }>(
    db,
    `INSERT INTO workspaces (name, slug, type, created_by)
     VALUES ('WS', $1, 'ORGANIZATION', $2) RETURNING id`,
    [`ws-${suffix}`, user.id]
  );

  await db.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role, status)
     VALUES ($1, $2, 'OWNER', 'ACTIVE')`,
    [workspace.id, user.id]
  );

  const event = await one<{ id: string }>(
    db,
    `INSERT INTO events (workspace_id, name, slug, status, visibility, verification_config, created_by)
     VALUES ($1, 'Test Event', $2, $3, 'PUBLIC', $4, $5) RETURNING id`,
    [
      workspace.id,
      slug,
      eventStatus,
      JSON.stringify({ method: verificationMethod }),
      user.id,
    ]
  );

  await db.query(
    `INSERT INTO workflow_stages (event_id, stage_type, display_name, status, display_order)
     VALUES ($1, 'VOTING', 'Voting', $2, 1)`,
    [event.id, votingStageStatus]
  );

  const category = await one<{ id: string }>(
    db,
    `INSERT INTO categories (event_id, name, display_order) VALUES ($1, 'Best Thing', 1) RETURNING id`,
    [event.id]
  );

  const nominee = await one<{ id: string }>(
    db,
    `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
     VALUES ($1, $2, 'Alice', 'alice', 1, 'ACTIVE') RETURNING id`,
    [event.id, category.id]
  );

  return {
    userId: user.id,
    workspaceId: workspace.id,
    eventId: event.id,
    categoryId: category.id,
    nomineeId: nominee.id,
    slug,
  };
}

async function one<T>(db: TestDb, sql: string, params: unknown[] = []): Promise<T> {
  const res = await db.query<T>(sql, params as never[]);
  if (!res.rows[0]) {
    throw new Error(`Expected a row from: ${sql}`);
  }
  return res.rows[0];
}
