import Link from "next/link";
import { getEventsAction } from "@/actions/events";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, ChevronRight } from "lucide-react";

export default async function GlobalExportsPage() {
  const events = await getEventsAction();

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          <span>Workspace Data Exporter Hub</span>
        </h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Select an event below to download spreadsheet logs (CSV) of votes, nominations, and voter telemetry.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="border-slate-200/80 bg-white rounded-3xl p-12 text-center text-slate-600 text-xs shadow-sm font-medium">
          No events found. Create an event to begin exporting reports.
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <Card
              key={evt.id}
              className="border-slate-200/80 hover:border-emerald-300 transition-all bg-white rounded-3xl shadow-sm"
            >
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{evt.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={evt.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                        {evt.status}
                      </Badge>
                      <span className="text-[10px] text-slate-500 font-medium">
                        CSV / Raw Logs Ready
                      </span>
                    </div>
                  </div>
                </div>

                <Link href={`/events/${evt.id}/exports`}>
                  <button className="h-9 px-4 rounded-full text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-all shadow-sm">
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
