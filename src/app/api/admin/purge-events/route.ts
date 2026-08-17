import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredDeletedEvents } from "@/lib/event-purge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Purge endpoint is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ success: true, ...(await purgeExpiredDeletedEvents()) }); }
  catch (error) { console.error("purge-events run failed:", error instanceof Error ? error.message : String(error)); return NextResponse.json({ error: "Event purge failed. See server logs." }, { status: 500 }); }
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }
