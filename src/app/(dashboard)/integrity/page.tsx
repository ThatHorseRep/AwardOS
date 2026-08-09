export const dynamic = "force-dynamic";

import Link from "next/link";
import { ShieldAlert, ShieldCheck, ChevronRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceIntegritySummaryAction } from "@/actions/integrity";

export default async function WorkspaceIntegrityPage() {
  const events = await getWorkspaceIntegritySummaryAction();

  const totalOpen = events.reduce((n, e) => n + e.openAlerts, 0);
  const totalCritical = events.reduce((n, e) => n + e.criticalAlerts, 0);
  const totalFlagged = events.reduce((n, e) => n + e.flaggedBallots, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-16">
      <div>
        <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-accent" />
          <span>Voting Integrity</span>
        </h1>
        <p className="text-content-muted text-xs mt-1 font-medium">
          Open alerts across your events. Select an event to run a scan, review flagged
          sessions, and resolve alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-3xl bg-surface border-border-subtle shadow-sm p-5">
          <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block">
            Open alerts
          </span>
          <span className="text-3xl font-extrabold text-content mt-1 block">{totalOpen}</span>
        </Card>
        <Card className="rounded-3xl bg-surface border-border-subtle shadow-sm p-5">
          <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block">
            Critical
          </span>
          <span
            className={`text-3xl font-extrabold mt-1 block ${
              totalCritical > 0 ? "text-rose-500" : "text-content"
            }`}
          >
            {totalCritical}
          </span>
        </Card>
        <Card className="rounded-3xl bg-surface border-border-subtle shadow-sm p-5">
          <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block">
            Flagged ballots
          </span>
          <span className="text-3xl font-extrabold text-content mt-1 block">{totalFlagged}</span>
        </Card>
      </div>

      {events.length === 0 ? (
        <Card className="rounded-3xl bg-surface border-border-subtle shadow-sm p-12 text-center text-content-muted text-xs font-medium">
          No events yet. Integrity monitoring begins once an event starts collecting ballots.
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const clean = event.openAlerts === 0;
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}/integrity`}
                className="block p-5 rounded-3xl bg-surface border border-border-subtle hover:border-accent/50 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        clean
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-rose-500/10 text-rose-500"
                      }`}
                    >
                      {clean ? (
                        <ShieldCheck className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-content leading-snug truncate">
                        {event.name}
                      </h3>
                      <p className="text-xs text-content-muted font-medium mt-0.5">
                        {event.submittedBallots} ballot
                        {event.submittedBallots === 1 ? "" : "s"}
                        {event.flaggedBallots > 0 && ` · ${event.flaggedBallots} flagged`}
                        {event.totalAlerts > 0 && ` · ${event.totalAlerts} alert${event.totalAlerts === 1 ? "" : "s"} total`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {event.criticalAlerts > 0 && (
                      <Badge variant="danger" size="sm">
                        {event.criticalAlerts} critical
                      </Badge>
                    )}
                    {event.openAlerts > 0 ? (
                      <Badge variant="warning" size="sm">
                        {event.openAlerts} open
                      </Badge>
                    ) : (
                      <Badge variant="success" size="sm">
                        Clear
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-content-muted" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
