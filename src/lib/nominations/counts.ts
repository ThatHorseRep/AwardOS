import { sql } from "drizzle-orm";
import { nominations } from "@/lib/db/schema";

/**
 * Current nomination counts are derived from the latest resolved nominations.
 * nominees.nominationCount remains a compatibility cache and must not be used
 * as the source of truth in application reads.
 */
export const authoritativeNominationCount = sql<number>`coalesce((
  select count(*)::int
  from ${nominations} as authoritative_nominations
  where authoritative_nominations.resolved_nominee_id = ${sql.raw('"nominees"."id"')}
    and authoritative_nominations.is_latest = true
), 0)`;
