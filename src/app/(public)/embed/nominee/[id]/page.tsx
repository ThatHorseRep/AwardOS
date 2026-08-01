import React from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { nominees, categories, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Trophy, ExternalLink } from "lucide-react";

export default async function NomineeEmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let nomineeData: any = null;

  try {
    const list = await db
      .select({
        nomineeId: nominees.id,
        nomineeName: nominees.name,
        photoUrl: nominees.photoUrl,
        categoryName: categories.name,
        eventName: events.name,
        eventSlug: events.slug,
      })
      .from(nominees)
      .innerJoin(categories, eq(nominees.categoryId, categories.id))
      .innerJoin(events, eq(nominees.eventId, events.id))
      .where(eq(nominees.id, id))
      .limit(1);

    if (list.length > 0) {
      nomineeData = list[0];
    }
  } catch (err) {
    console.error("Failed to load embed nominee data:", err);
  }

  const nomineeName = nomineeData?.nomineeName || "Nominee Candidate";
  const categoryName = nomineeData?.categoryName || "Award Category";
  const eventSlug = nomineeData?.eventSlug || "award-program";
  const voteUrl = `/e/${eventSlug}?candidate=${id}`;

  return (
    <div className="w-full h-full p-2.5 bg-white font-sans text-slate-900 select-none flex items-center justify-between gap-3 border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm shadow-blue-600/20">
          <Trophy className="w-5 h-5 text-amber-300" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-extrabold text-slate-900 truncate leading-tight">
            {nomineeName}
          </h4>
          <p className="text-[10px] text-slate-500 truncate font-medium mt-0.5">
            {categoryName}
          </p>
        </div>
      </div>

      <a
        href={voteUrl}
        target="_blank"
        rel="noreferrer"
        className="px-3.5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 transition-all shadow-md shadow-blue-600/20 hover:scale-105"
      >
        <span>Vote Now</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
