import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { events, voteSessions, workflowStages } from "@/lib/db/schema";
import { getClientIp } from "@/lib/request-ip";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const schema = z.object({ sessionId: z.string().trim().min(10).max(255) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4 * 1024) return NextResponse.json({ error: "Request payload is too large." }, { status: 413 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ballot session." }, { status: 400 });
  const [event] = await db.select().from(events).where(and(eq(events.slug, slug), eq(events.status, "ACTIVE"), isNull(events.deletedAt))).limit(1);
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (event.visibility === "PRIVATE") return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const ipAddress = getClientIp(request.headers);
  const limit = await consumeRateLimit(`ballot-session:${event.id}`, ipAddress, { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: "Too many ballot session attempts. Please try again later." }, { status: 429, headers: rateLimitHeaders(limit) });
  const [stage] = await db.select().from(workflowStages).where(and(eq(workflowStages.eventId, event.id), eq(workflowStages.stageType, "VOTING"), eq(workflowStages.status, "ACTIVE"))).limit(1);
  const now = new Date();
  if (!stage || (stage.startsAt && now < stage.startsAt) || (stage.endsAt && now > stage.endsAt)) return NextResponse.json({ error: "Voting is not currently open for this event." }, { status: 403 });
  const token = `ballot-${parsed.data.sessionId}`;
  await db.insert(voteSessions).values({ eventId: event.id, sessionToken: token, ipAddress, userAgent: (request.headers.get("user-agent") ?? "").slice(0, 1000), verificationMethod: ((event.verificationConfig as { method?: "NONE" | "EMAIL_OTP" | "INVITATION_CODE" })?.method ?? "NONE"), status: "IN_PROGRESS" }).onConflictDoNothing();
  return NextResponse.json({ success: true });
}
