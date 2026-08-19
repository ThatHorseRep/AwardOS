export const dynamic = "force-dynamic";

import Link from "next/link";
import { ShieldAlert, ShieldCheck, ChevronRight, AlertTriangle, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceIntegritySummaryAction } from "@/actions/integrity";

export default async function WorkspaceIntegrityPage() {
  const events = await getWorkspaceIntegritySummaryAction();

  const totalOpen = events.reduce((n, e) => n + e.openAlerts, 0);
  const totalCritical = events.reduce((n, e) => n + e.criticalAlerts, 0);
  const totalFlagged = events.reduce((n, e) => n + e.flaggedBallots, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-16 animate-page-entrance text-content">
      <div>
        <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-accent" />
          <span>Voting integrity</span>
        </h1>
        <p className="text-content-secondary text-xs mt-1 font-normal">
          Open alerts across your events. Select an event to run a scan, review flagged
          sessions, and resolve alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl bg-surface border-border-subtle shadow-sm p-5 hover-lift text-content">
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">
            Open alerts
          </span>
          <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{totalOpen}</span>
        </Card>
        <Card className="rounded-2xl bg-surface border-border-subtle shadow-sm p-5 hover-lift text-content">
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">
            Critical
          </span>
          <span
            className={`text-3xl font-bold mt-1 block tabular-nums ${
              totalCritical > 0 ? "text-destructive" : "text-content"
            }`}
          >
            {totalCritical}
          </span>
        </Card>
        <Card className="rounded-2xl bg-surface border-border-subtle shadow-sm p-5 hover-lift text-content">
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">
            Flagged ballots
          </span>
          <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{totalFlagged}</span>
        </Card>
      </div>

      {events.length === 0 ? (
        <Card className="rounded-2xl bg-surface border-border-subtle shadow-sm p-12 text-center text-content-secondary text-xs font-normal">
          <p className="font-semibold text-content">No events to monitor yet.</p>
          <p className="mt-1">Integrity monitoring begins after an event starts collecting submitted ballots.</p>
          <Link href="/events/new" className="mt-4 inline-flex"><Button size="sm"><Plus className="mr-2 size-4" />Create event</Button></Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const clean = event.openAlerts === 0;
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}/integrity`}
                className="block p-5 rounded-2xl bg-surface border border-border-subtle hover:border-accent hover-lift shadow-sm transition-all text-content"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border-subtle ${
                        clean
                          ? "bg-surface-raised text-success"
                          : "bg-surface-raised text-destructive"
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
                      <p className="text-xs text-content-secondary font-normal mt-0.5">
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
                    <ChevronRight className="w-4 h-4 text-content-secondary" />
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
