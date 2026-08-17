import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { serializeExportSnapshot } from "@/lib/export-serialize";
import { createTestDb, seedVotingFixture, truncateAll, type TestDb } from "../helpers/db";

describe("release data workflows", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await truncateAll(db);
  });

  it("rolls back a failed import completely and permits a clean retry", async () => {
    const fixture = await seedVotingFixture(db, { slug: "import-rollback" });
    const key = "c".repeat(64);

    await expect(
      db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO import_runs (event_id, requested_by, idempotency_key)
           VALUES ($1, $2, $3)`,
          [fixture.eventId, fixture.userId, key] as never[],
        );
        const category = await tx.query<{ id: string }>(
          `INSERT INTO categories (event_id, name, display_order)
           VALUES ($1, 'Imported Category', 2) RETURNING id`,
          [fixture.eventId] as never[],
        );
        await tx.query(
          `INSERT INTO nominees (event_id, category_id, name, normalized_name, display_order, status)
           VALUES ($1, $2, 'Imported Nominee', 'imported nominee', 1, 'ACTIVE')`,
          [fixture.eventId, category.rows[0].id] as never[],
        );
        throw new Error("simulated row failure");
      }),
    ).rejects.toThrow("simulated row failure");

    const afterFailure = await db.query<{ categories: number; nominees: number; runs: number }>(
      `SELECT
         (SELECT count(*)::int FROM categories WHERE event_id = $1 AND name = 'Imported Category') AS categories,
         (SELECT count(*)::int FROM nominees WHERE event_id = $1 AND normalized_name = 'imported nominee') AS nominees,
         (SELECT count(*)::int FROM import_runs WHERE event_id = $1 AND idempotency_key = $2) AS runs`,
      [fixture.eventId, key] as never[],
    );
    expect(afterFailure.rows[0]).toEqual({ categories: 0, nominees: 0, runs: 0 });

    await expect(
      db.query(
        `INSERT INTO import_runs (event_id, requested_by, idempotency_key, result, completed_at)
         VALUES ($1, $2, $3, $4, now())`,
        [fixture.eventId, fixture.userId, key, JSON.stringify({ success: true })] as never[],
      ),
    ).resolves.toBeTruthy();
  });

  it("re-downloads the stored export snapshot after source records change", async () => {
    const fixture = await seedVotingFixture(db, { slug: "export-snapshot" });
    const snapshot = [{ Category: "Best Thing", Nominee: "Alice", Votes: 4 }];
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO export_jobs
         (event_id, requested_by, export_type, format, status, payload_snapshot, row_count, completed_at)
       VALUES ($1, $2, 'OFFICIAL_RESULTS', 'CSV', 'COMPLETED', $3, 1, now()) RETURNING id`,
      [fixture.eventId, fixture.userId, JSON.stringify(snapshot)] as never[],
    );

    await db.query(`UPDATE nominees SET name = 'Renamed Later' WHERE id = $1`, [fixture.nomineeId] as never[]);
    const job = await db.query<{ payload_snapshot: typeof snapshot }>(
      `SELECT payload_snapshot FROM export_jobs WHERE id = $1`,
      [inserted.rows[0].id] as never[],
    );
    const first = await serializeExportSnapshot(job.rows[0].payload_snapshot, "CSV", "results", "Official Results");
    const second = await serializeExportSnapshot(job.rows[0].payload_snapshot, "CSV", "results", "Official Results");

    expect(first.body.equals(second.body)).toBe(true);
    expect(first.body.toString()).toContain("Alice");
    expect(first.body.toString()).not.toContain("Renamed Later");
  });

  it("hides a soft-deleted event, restores it, and retains both audit records", async () => {
    const fixture = await seedVotingFixture(db, { slug: "recoverable-event" });
    await db.transaction(async (tx) => {
      await tx.query(`UPDATE events SET deleted_at = now() WHERE id = $1`, [fixture.eventId] as never[]);
      await tx.query(
        `INSERT INTO audit_logs (workspace_id, event_id, actor_id, action, target_type, target_id)
         VALUES ($1, $2, $3, 'event.deleted', 'event', $2)`,
        [fixture.workspaceId, fixture.eventId, fixture.userId] as never[],
      );
    });

    const hidden = await db.query(
      `SELECT id FROM events WHERE slug = $1 AND deleted_at IS NULL`,
      [fixture.slug] as never[],
    );
    expect(hidden.rows).toHaveLength(0);

    await db.transaction(async (tx) => {
      await tx.query(`UPDATE events SET deleted_at = NULL WHERE id = $1`, [fixture.eventId] as never[]);
      await tx.query(
        `INSERT INTO audit_logs (workspace_id, event_id, actor_id, action, target_type, target_id)
         VALUES ($1, $2, $3, 'event.restored', 'event', $2)`,
        [fixture.workspaceId, fixture.eventId, fixture.userId] as never[],
      );
    });

    const restored = await db.query(`SELECT id FROM events WHERE slug = $1 AND deleted_at IS NULL`, [fixture.slug] as never[]);
    const audit = await db.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE event_id = $1 ORDER BY created_at`,
      [fixture.eventId] as never[],
    );
    expect(restored.rows).toHaveLength(1);
    expect(audit.rows.map((row) => row.action)).toEqual(["event.deleted", "event.restored"]);
  });
});
