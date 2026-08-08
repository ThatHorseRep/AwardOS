import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { getAIModel } from "@/lib/ai/provider";
import { requireWorkspaceRole, ALL_MEMBERS } from "@/actions/_rbac";

export async function POST(req: NextRequest) {
  try {
    // This route bills tokens to the workspace's own AI keys, so it has to be
    // seated-member-only. Unauthenticated it was an open LLM gateway that
    // anyone on the internet could point at any model via the body below.
    try {
      await requireWorkspaceRole(ALL_MEMBERS);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, provider, model } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const aiModel = getAIModel({ provider, model });

    const systemPrompt = `You are the AwardOS AI Co-Pilot — an intelligent assistant designed specifically for award event organizers, committee members, and hosts.
Your goals:
- Help draft event descriptions, category guidelines, invitation announcements, and social posts.
- Assist in generating award ceremony MC scripts, opening remarks, and winner announcement speeches.
- Provide advice on voter integrity, fraud prevention, deduplication, and nomination management.
- Be concise, inspiring, professional, and directly actionable. Use bullet points and clear markdown formatting.`;

    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("AI Chat API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process AI chat request" },
      { status: 500 }
    );
  }
}
