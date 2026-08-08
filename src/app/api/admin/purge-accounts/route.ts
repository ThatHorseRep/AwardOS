import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredAccounts } from "@/lib/account-purge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled purge for accounts whose 30-day deletion window has closed
 * (FR-AUTH-06). Intended to run daily — e.g. a Vercel cron entry:
 *
 *   { "crons": [{ "path": "/api/admin/purge-accounts", "schedule": "0 3 * * *" }] }
 *
 * Vercel cron requests carry `Authorization: Bearer $CRON_SECRET`, which is what
 * this route checks. The route refuses to run at all without CRON_SECRET set,
 * rather than defaulting open — an unauthenticated endpoint here would delete
 * accounts on demand.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("purge-accounts: CRON_SECRET is not configured; refusing to run.");
    return NextResponse.json(
      { error: "Purge endpoint is not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await purgeExpiredAccounts();

    // Report a partial failure honestly — a 200 here would let a broken purge
    // look healthy on the cron dashboard while PII sat past its deadline.
    const status = summary.failed > 0 ? 500 : 200;

    return NextResponse.json({ success: summary.failed === 0, ...summary }, { status });
  } catch (error) {
    console.error(
      "purge-accounts run failed:",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      { error: "Account purge failed. See server logs." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
