import { NextRequest, NextResponse } from "next/server";
import { runAINominationCleanup, RawNominationItem } from "@/lib/ai/cleanup";

export async function POST(request: NextRequest) {
  try {
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
