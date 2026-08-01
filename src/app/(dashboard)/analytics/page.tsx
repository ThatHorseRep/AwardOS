export const dynamic = "force-dynamic";

import Link from "next/link";
import { getEventsAction } from "@/actions/events";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TrendingUp, ChevronRight, BarChart3 } from "lucide-react";

export default async function GlobalAnalyticsPage() {
  const events = await getEventsAction();

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <span>Real-Time Analytics & Telemetry Directory</span>
        </h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Select an event below to track voting velocities, voter device distributions, and category turnouts.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border-slate-200/80 bg-white p-12 text-center text-slate-500 text-xs shadow-sm rounded-3xl font-medium">
          No events found. Create an event to begin tracking telemetry and analytics.
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
                      Active Voting Telemetry
                    </span>
                  </div>
                </div>
              </div>

              <Link href={`/events/${evt.id}/analytics`}>
                <button className="px-4 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20">
                  <span>View Analytics</span>
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
