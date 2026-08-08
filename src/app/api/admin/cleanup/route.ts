import { NextRequest, NextResponse } from "next/server";
import { runAINominationCleanup, RawNominationItem } from "@/lib/ai/cleanup";
import { requireWorkspaceRole, EVENT_ADMINS } from "@/actions/_rbac";

export async function POST(request: NextRequest) {
  try {
    // Despite the /admin/ path this had no guard at all — anyone could spend the
    // workspace's AI budget by posting a nominations array. The DB-backed
    // equivalent (`triggerAICleanupAction`) gates at EVENT_ADMINS; match it.
    // This route takes its input from the body and touches no event row, so
    // there is nothing narrower than the workspace to scope against.
    try {
      await requireWorkspaceRole(EVENT_ADMINS);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { nominations } = body as { nominations: RawNominationItem[] };

    if (!nominations || !Array.isArray(nominations)) {
      return NextResponse.json(
        { error: "Invalid request payload. Nominations array required." },
        { status: 400 }
      );
    }

    const result = await runAINominationCleanup(nominations);

    return NextResponse.json({
      success: true,
      message: "AI Nomination Cleanup completed successfully",
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error during AI cleanup" },
      { status: 500 }
    );
  }
}
