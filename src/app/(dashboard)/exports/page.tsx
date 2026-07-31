import Link from "next/link";
import { getEventsAction } from "@/actions/events";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, ChevronRight } from "lucide-react";

export default async function GlobalExportsPage() {
  const events = await getEventsAction();

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          <span>Workspace Data Exporter Hub</span>
        </h1>
        <p className="text-zinc-400 text-xs mt-1">
          Select an event below to download spreadsheet logs (CSV) of votes, nominations, and voter telemetry.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border-slate-800 bg-slate-950/20 p-12 text-center text-slate-500 text-xs">
          No events found. Create an event to begin exporting reports.
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <Card
              key={evt.id}
              className="border-slate-850 hover:border-indigo-500/30 transition-all bg-slate-950/10"
            >
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-snug">{evt.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={evt.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                        {evt.status}
                      </Badge>
                      <span className="text-[10px] text-zinc-500">
                        CSV / Raw Logs Ready
                      </span>
                    </div>
                  </div>
                </div>

                <Link href={`/events/${evt.id}/exports`}>
                  <button className="h-8 px-3 rounded-lg text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/15 flex items-center gap-1.5 transition-all">
                    <span>Export Center</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
