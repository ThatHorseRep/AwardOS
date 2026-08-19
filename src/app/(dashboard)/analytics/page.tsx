export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEventsAction } from "@/actions/events";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrendingUp, ChevronRight, BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function GlobalAnalyticsPage() {
  const events = await getEventsAction();

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <span>Voting activity</span>
        </h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Select an event to see submitted ballots, turnout, voting pace, and device information.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border-border-subtle bg-surface p-12 text-center text-content-secondary text-xs shadow-sm rounded-2xl font-medium">
          <p className="font-semibold text-content">No events to monitor yet.</p>
          <p className="mt-1">Create an event first. Submitted ballot activity will appear here after voting begins.</p>
          <Link href="/events/new" className="mt-4 inline-flex"><Button size="sm"><Plus className="mr-2 size-4" />Create event</Button></Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-5 rounded-3xl bg-white border border-slate-200/80 hover:border-blue-500/50 hover:shadow-md transition-all flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{evt.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={evt.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                      {evt.status}
                    </Badge>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Voting activity and turnout
                    </span>
                  </div>
                </div>
              </div>

              <Link href={`/events/${evt.id}/analytics`}>
                <button className="px-4 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20">
                  <span>View activity</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
