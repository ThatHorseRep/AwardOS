"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { createExportJobAction, getExportJobsAction } from "@/actions/exports";
import { getEventDetailsAction } from "@/actions/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";

type ExportType =
  | "NOMINATIONS_RAW"
  | "NOMINATIONS_CLEAN"
  | "VOTES_RAW"
  | "OFFICIAL_RESULTS"
  | "ANALYTICS"
  | "FULL_REPORT";
type ExportFormat = "CSV" | "XLSX" | "JSON" | "PDF";
type Job = Awaited<ReturnType<typeof getExportJobsAction>>[number];

const REPORTS: Array<{ type: ExportType; title: string; description: string }> =
  [
    {
      type: "NOMINATIONS_RAW",
      title: "Raw nominations",
      description: "Every submitted nomination for this event.",
    },
    {
      type: "NOMINATIONS_CLEAN",
      title: "Cleaned nominees",
      description: "Final nominee roster grouped by category.",
    },
    {
      type: "VOTES_RAW",
      title: "Raw ballots",
      description: "Submitted ballot selections and verification metadata.",
    },
    {
      type: "OFFICIAL_RESULTS",
      title: "Official results",
      description: "Event-scoped nominee totals from submitted ballots.",
    },
    {
      type: "ANALYTICS",
      title: "Analytics summary",
      description: "Submission, ballot, category, and nominee totals.",
    },
    {
      type: "FULL_REPORT",
      title: "Audit log",
      description: "Organizer actions recorded for this event.",
    },
  ];

export default function EventExportsPage() {
  const eventId = useParams<{ id: string }>().id;
  const toast = useToast();
  const [eventName, setEventName] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sensitiveTypes, setSensitiveTypes] = useState<Set<ExportType>>(
    new Set(),
  );
  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [event, nextJobs] = await Promise.all([
        getEventDetailsAction(eventId),
        getExportJobsAction(eventId),
      ]);
      setEventName(event?.name ?? "Event");
      setJobs(nextJobs);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!jobs.some((job) => job.status === "PROCESSING")) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [jobs, load]);

  async function create(type: ExportType, format: ExportFormat) {
    setBusy(`${type}:${format}`);
    try {
      const result = await createExportJobAction(
        eventId,
        type,
        format,
        sensitiveTypes.has(type),
      );
      await load();
      if (result.ready)
        window.location.assign(`/api/exports/${result.jobId}/download`);
      else
        toast.success(
          "This large export is processing and will appear in recent exports when ready.",
        );
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "We could not generate this export.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading)
    return (
      <div className="min-h-80 animate-pulse rounded-xl bg-surface-muted" />
    );
  if (loadError) return <LoadError onRetry={() => void load()} />;
  return (
    <main className="mx-auto max-w-6xl space-y-6 pb-16 text-content">
      <header className="flex items-start gap-3">
        <Link href={`/events/${eventId}`}>
          <Button variant="ghost" size="icon" aria-label="Back to event">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Exports</h1>
          <p className="mt-1 text-sm text-content-secondary">
            {eventName}. Each job stores an immutable event-scoped snapshot for
            later re-download.
          </p>
        </div>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.type}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-accent" />
                <CardTitle>{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-content-secondary">
                {report.description}
              </p>
              {(report.type === "VOTES_RAW" ||
                report.type === "FULL_REPORT") && (
                <label className="mt-4 flex items-start gap-2 text-sm text-content-secondary">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={sensitiveTypes.has(report.type)}
                    onChange={(event) =>
                      setSensitiveTypes((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(report.type);
                        else next.delete(report.type);
                        return next;
                      })
                    }
                  />
                  <span>
                    Include sensitive email and IP fields. Share and store this
                    export carefully.
                  </span>
                </label>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
              {(["CSV", "XLSX", "JSON", "PDF"] as const).map((format) => (
                  <Button
                    key={format}
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void create(report.type, format)}
                  >
                    {busy === `${report.type}:${format}` ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 size-4" />
                    )}
                    {format}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      {jobs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Recent exports</h2>
          <div className="mt-3 divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {jobs.slice(0, 20).map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {job.exportType.replaceAll("_", " ").toLowerCase()}
                  </p>
                  <p className="text-sm text-content-secondary">
                    {job.rowCount ?? 0} rows · {job.format} ·{" "}
                    {new Date(job.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      job.status === "COMPLETED"
                        ? "success"
                        : job.status === "FAILED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {job.status.toLowerCase()}
                  </Badge>
                  {job.status === "COMPLETED" && (
                    <Link href={`/api/exports/${job.id}/download`}>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Download export again"
                      >
                        <Download className="size-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
