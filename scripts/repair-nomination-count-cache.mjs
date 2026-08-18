import "dotenv/config";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local", override: false });

const APPLY = process.argv.includes("--apply");
const ROLLBACK = process.argv.includes("--rollback");
if (APPLY && ROLLBACK) throw new Error("Choose --apply or --rollback, not both.");

const targets = [
  { event: "Disciples Awards 1.0", category: "The Butt of Most Jokes", nominee: "Black", id: "2afa2c90-8690-4da1-bbbc-8cb79cddbca3", before: 1, after: 0 },
  { event: "Disciples Awards 1.0", category: "The Butt of Most Jokes", nominee: "MBlack", id: "99825e9a-682e-4889-ba01-e9e87e79e0b7", before: 5, after: 3 },
  { event: "The Disciples Awards 2.0", category: "The Butt of Most Jokes", nominee: "Black", id: "c5baa44d-c5b8-4fe9-a793-0b928bcb19a4", before: 4, after: 2 },
  { event: "The Disciples Awards 2.0", category: "The Butt of Most Jokes", nominee: "Blaq", id: "cf7fe719-cbec-4df0-8f88-d8d1cd750123", before: 2, after: 0 },
];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");
const sql = postgres(connectionString, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10 });

try {
  const result = await sql.begin(async (tx) => {
    await tx`set transaction isolation level serializable`;
    const protectedCountsBefore = await tx`
      select
        (select count(*)::int from nominations) as nominations,
        (select count(*)::int from nominees) as nominees,
        (select count(*)::int from vote_sessions) as vote_sessions,
        (select count(*)::int from votes) as votes,
        (select count(*)::int from official_results) as official_results
    `;
    const protectedRowsBefore = await tx`
      select id, to_jsonb(nominees) - 'nomination_count' - 'updated_at' as protected
      from nominees
      where id in ${sql(targets.map((target) => target.id))}
      order by id
    `;
    const rows = await tx`
      select
        n.id,
        e.name as event_name,
        c.name as category_name,
        n.name as nominee_name,
        n.nomination_count as stored_count,
        count(raw.id) filter (where raw.is_latest is true and raw.resolved_nominee_id = n.id)::int as derived_count
      from nominees n
      join events e on e.id = n.event_id
      join categories c on c.id = n.category_id
      left join nominations raw on raw.event_id = n.event_id and raw.category_id = n.category_id
      where n.id in ${sql(targets.map((target) => target.id))}
      group by n.id, e.name, c.name, n.name, n.nomination_count
      order by e.name, c.name, n.name
    `;

    const byId = new Map(rows.map((row) => [row.id, row]));
    const report = targets.map((target) => {
      const row = byId.get(target.id);
      if (!row) throw new Error(`Target nominee not found: ${target.id}`);
      const stored = Number(row.stored_count ?? 0);
      const derived = Number(row.derived_count ?? 0);
      const sourceValue = ROLLBACK ? target.after : target.before;
      const replacementValue = ROLLBACK ? target.before : target.after;
      if (![sourceValue, replacementValue].includes(stored) || derived !== target.after) {
        throw new Error(
          `Precondition changed for ${target.nominee}: stored=${stored}, derived=${derived}; expected stored ${sourceValue} or ${replacementValue}, derived ${target.after}.`,
        );
      }
      return {
        id: target.id,
        event: row.event_name,
        category: row.category_name,
        nominee: row.nominee_name,
        cachedBefore: stored,
        authoritativeDerived: derived,
        proposedReplacement: replacementValue,
        changed: false,
        reason: "Latest resolved nominations are authoritative; the cached field is compatibility state only.",
      };
    });

    if (APPLY || ROLLBACK) {
      for (const item of report) {
        if (item.cachedBefore === item.proposedReplacement) continue;
        const updated = await tx`
          update nominees
          set nomination_count = ${item.proposedReplacement}, updated_at = now()
          where id = ${item.id} and nomination_count = ${item.cachedBefore}
          returning id
        `;
        if (updated.length !== 1) throw new Error(`Expected one ${ROLLBACK ? "rolled-back" : "repaired"} row for ${item.id}.`);
        item.changed = true;
      }
    }

    const protectedCountsAfter = await tx`
      select
        (select count(*)::int from nominations) as nominations,
        (select count(*)::int from nominees) as nominees,
        (select count(*)::int from vote_sessions) as vote_sessions,
        (select count(*)::int from votes) as votes,
        (select count(*)::int from official_results) as official_results
    `;
    const protectedRowsAfter = await tx`
      select id, to_jsonb(nominees) - 'nomination_count' - 'updated_at' as protected
      from nominees
      where id in ${sql(targets.map((target) => target.id))}
      order by id
    `;
    if (JSON.stringify(protectedCountsBefore) !== JSON.stringify(protectedCountsAfter)) {
      throw new Error("Protected table counts changed during nomination-count repair.");
    }
    if (JSON.stringify(protectedRowsBefore) !== JSON.stringify(protectedRowsAfter)) {
      throw new Error("Protected nominee fields changed during nomination-count repair.");
    }

    return {
      mode: APPLY ? "apply" : ROLLBACK ? "rollback" : "dry-run",
      report,
      protectedTableCounts: protectedCountsAfter[0],
      protectedFieldsUnchanged: true,
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await sql.end({ timeout: 5 });
}
