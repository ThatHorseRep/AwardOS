import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { getAIModel, type AIProvider } from "@/lib/ai/provider";
import { requireWorkspaceRole, requireEventAccess, ALL_MEMBERS } from "@/actions/_rbac";
import { getClientIp } from "@/lib/request-ip";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > 128 * 1024) return NextResponse.json({ error: "Request payload is too large." }, { status: 413 });
    // This route bills tokens to the workspace's own AI keys, so it has to be
    // seated-member-only. Unauthenticated it was an open LLM gateway that
    // anyone on the internet could point at any model via the body below.
    try {
      const { user, workspace } = await requireWorkspaceRole(ALL_MEMBERS);
      const limit = await consumeRateLimit(`ai-chat:${workspace.id}`, `${user.id}:${getClientIp(req.headers)}`, { limit: 30, windowMs: 60 * 1000 });
      if (!limit.allowed) return NextResponse.json({ error: "Too many AI requests. Please try again shortly." }, { status: 429, headers: rateLimitHeaders(limit) });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const messages = body?.messages;
    const eventId = typeof body?.eventId === "string" ? body.eventId : null;
    const provider = body?.provider ?? process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER ?? "google";
    const model = body?.model ?? ({ google: "gemini-2.5-flash", openai: "gpt-4o-mini", anthropic: "claude-3-5-haiku-20241022" } as Record<string, string>)[provider];

    if (!messages || !Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }
    const allowedModels: Record<string, string[]> = { google: ["gemini-2.5-flash"], openai: ["gpt-4o-mini"], anthropic: ["claude-3-5-haiku-20241022"] };
    if (typeof provider !== "string" || !allowedModels[provider]?.includes(model) || JSON.stringify(messages).length > 100_000) return NextResponse.json({ error: "AI request fields are invalid." }, { status: 400 });

    const aiModel = getAIModel({ provider: provider as AIProvider, model });

    const systemPrompt = `You are the AwardOS AI Co-Pilot — an intelligent assistant designed specifically for award event organizers, committee members, and hosts.
Your goals:
- Help draft event descriptions, category guidelines, invitation announcements, and social posts.
- Assist in generating award ceremony MC scripts, opening remarks, and winner announcement speeches.
- Provide advice on voter integrity, fraud prevention, deduplication, and nomination management.
- Be concise, inspiring, professional, and directly actionable. Use bullet points and clear markdown formatting.`;
    const eventContext = eventId ? (await requireEventAccess(eventId, ALL_MEMBERS)).event : null;

    const result = streamText({
      model: aiModel,
      system: `${systemPrompt}${eventContext ? `\nCurrent event context: name=${eventContext.name}; description=${eventContext.description ?? "none"}; status=${eventContext.status}; visibility=${eventContext.visibility}. Do not invent event facts beyond this context.` : ""}`,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    console.error("AI Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to process AI chat request" },
      { status: 500 }
    );
  }
}
