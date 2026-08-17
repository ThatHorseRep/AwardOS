"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, RefreshCw, Check, X, Trash2, Users, ShieldCheck, History, Loader2, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventsAction } from "@/actions/events";
import { useToast } from "@/components/ui/toast";
import { triggerAICleanupAction, getLatestCleanupTaskAction, approveMergeSuggestionAction, rejectMergeSuggestionAction, bulkApproveMergeSuggestionsAction } from "@/actions/cleanup";
import { LoadError } from "@/components/shared/load-error";

type EventSummary = Awaited<ReturnType<typeof getEventsAction>>[number];
type CleanupTask = Awaited<ReturnType<typeof getLatestCleanupTaskAction>>;
type CleanupSuggestion = NonNullable<CleanupTask>["suggestions"][number];
type LocalAuditLog = { id: string; action: string; time: string; type: "AUTO" | "MANUAL" };
type CleanupStats = { blankRemovedCount?: number; normalizedCount?: number };

export default function AICleanupReviewPage() {
  const toast = useToast();
  const [eventsList, setEventsList] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [taskLoadError, setTaskLoadError] = useState(false);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [taskData, setTaskData] = useState<CleanupTask>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "high" | "medium">("all");
  const [auditLogs, setAuditLogs] = useState<LocalAuditLog[]>([]);

  // Load events list on mount
  useEffect(() => {
    async function loadEvents() {
      setLoading(true); setLoadError(false);
      try {
        const events = await getEventsAction();
        setEventsList(events || []);
        if (events && events.length > 0) {
          setSelectedEventId(events[0].id);
        }
      } catch (err) {
        console.error("Failed to load events for AI cleanup review:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, [loadAttempt]);

  // Fetch task data when selectedEventId changes
  const loadTaskData = async (eventId: string) => {
    if (!eventId) return;
    setTaskLoadError(false);
    try {
      const data = await getLatestCleanupTaskAction(eventId);
      setTaskData(data);
    } catch (err) {
      console.error("Failed to load cleanup task for event:", err);
      setTaskLoadError(true);
    }
  };

  useEffect(() => {
    if (selectedEventId) {
      loadTaskData(selectedEventId);
    }
  }, [selectedEventId]);

  const handleRunCleanup = async () => {
    if (!selectedEventId) return;
    setIsRunningCleanup(true);
    try {
      await triggerAICleanupAction(selectedEventId);
      await loadTaskData(selectedEventId);
      setAuditLogs([
        {
          id: Date.now().toString(),
          action: "Ran One-Click AI Nomination Scan & LLM Deduplication",
          time: "Just now",
          type: "AUTO",
        },
        ...auditLogs,
      ]);
    } catch (err: unknown) {
      console.error("Error triggering AI cleanup:", err);
      toast.error(err instanceof Error ? err.message : "Failed to run AI cleanup scan.");
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const handleApprove = async (suggestionId: string, primaryName: string, dupName: string) => {
    setActionLoading(suggestionId);
    try {
      await approveMergeSuggestionAction(suggestionId);
      await loadTaskData(selectedEventId);
      setAuditLogs([
        {
          id: Date.now().toString(),
          action: `Approved Merge: '${dupName}' into '${primaryName}'`,
          time: "Just now",
          type: "MANUAL",
        },
        ...auditLogs,
      ]);
    } catch (err: unknown) {
      console.error("Error approving merge:", err);
      toast.error(err instanceof Error ? err.message : "Failed to approve merge.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (suggestionId: string, primaryName: string, dupName: string) => {
    setActionLoading(suggestionId);
    try {
      await rejectMergeSuggestionAction(suggestionId);
      await loadTaskData(selectedEventId);
      setAuditLogs([
        {
          id: Date.now().toString(),
          action: `Rejected Merge: Kept '${primaryName}' & '${dupName}' separate`,
          time: "Just now",
          type: "MANUAL",
        },
        ...auditLogs,
      ]);
    } catch (err: unknown) {
      console.error("Error rejecting merge:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reject merge.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAllHigh = async () => {
    const suggestions = taskData?.suggestions || [];
    const highPending = suggestions.filter(
      (s: CleanupSuggestion) => s.status === "PENDING" && s.confidenceTier === "HIGH"
    );
    if (highPending.length === 0) return;

    setIsRunningCleanup(true);
    try {
      const ids = highPending.map((s) => s.id);
      await bulkApproveMergeSuggestionsAction(ids);
      await loadTaskData(selectedEventId);
      setAuditLogs([
        {
          id: Date.now().toString(),
          action: `Bulk Approved ${highPending.length} High-Confidence Merges (≥85%)`,
          time: "Just now",
          type: "MANUAL",
        },
        ...auditLogs,
      ]);
    } catch (err: unknown) {
      console.error("Error bulk approving merges:", err);
      toast.error(err instanceof Error ? err.message : "Bulk approval failed.");
    } finally {
      setIsRunningCleanup(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }
  if (loadError) return <LoadError onRetry={() => setLoadAttempt((value) => value + 1)} />;
  if (taskLoadError) return <LoadError message="We could not load the cleanup review." onRetry={() => void loadTaskData(selectedEventId)} />;

  if (eventsList.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4 font-sans select-none animate-page-entrance text-content">
        <Card className="border-border-subtle bg-surface rounded-2xl p-8 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-content">No award events available</h2>
          <p className="text-xs text-content-secondary font-normal max-w-sm mx-auto leading-relaxed">
            Create an award event and collect nominations to utilize the AI nomination cleanup engine.
          </p>
          <div className="pt-2">
            <Link href="/events/new">
              <Button className="rounded-xl font-semibold text-xs px-6">
                Create first event
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const suggestions = taskData?.suggestions || [];
  const pendingSuggestions = suggestions.filter((s) => s.status === "PENDING");
  const approvedSuggestions = suggestions.filter((s) => s.status === "APPROVED");

  const filteredSuggestions = pendingSuggestions.filter((s) => {
    if (activeFilter === "high") return s.confidenceTier === "HIGH";
    if (activeFilter === "medium") return s.confidenceTier === "MEDIUM";
    return true;
  });

  const selectedEvent = eventsList.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans select-none pb-16 animate-page-entrance text-content">
      {/* Header Bar & Event Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent animate-pulse" />
            <span>AI nomination cleanup engine</span>
          </h1>
          <p className="text-content-secondary text-xs mt-1 font-normal">
            Automated blank removal, capitalization normalization, and LLM-assisted duplicate nominee resolution.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Event Selector Dropdown */}
          <div className="flex items-center gap-2 bg-surface-raised border border-border-subtle rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-accent shrink-0" />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="text-xs font-semibold text-content bg-transparent focus:outline-none cursor-pointer"
            >
              {eventsList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleApproveAllHigh}
            disabled={!pendingSuggestions.some((s) => s.confidenceTier === "HIGH") || isRunningCleanup}
            className="rounded-xl font-semibold text-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-success mr-1.5" />
            <span>Approve all high (≥85%)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={isRunningCleanup}
            onClick={handleRunCleanup}
            className="rounded-xl font-semibold text-xs px-4"
          >
            {isRunningCleanup ? (
              <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            <span>{taskData ? "Re-run AI scan" : "Run one-click AI scan"}</span>
          </Button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-content-secondary font-semibold uppercase tracking-wider">
              <span>Blanks removed</span>
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div className="text-3xl font-bold text-content mt-2 tabular-nums">
              {(taskData?.task?.stats as CleanupStats | undefined)?.blankRemovedCount || 0}
            </div>
            <span className="text-xs text-content-secondary font-normal">Auto-filtered by AI</span>
          </CardContent>
        </Card>

        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-content-secondary font-semibold uppercase tracking-wider">
              <span>Normalized</span>
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <div className="text-3xl font-bold text-content mt-2 tabular-nums">
              {(taskData?.task?.stats as CleanupStats | undefined)?.normalizedCount || 0}
            </div>
            <span className="text-xs text-content-secondary font-normal">Title Case formatted</span>
          </CardContent>
        </Card>

        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-content-secondary font-semibold uppercase tracking-wider">
              <span>Duplicates flagged</span>
              <Users className="w-4 h-4 text-accent" />
            </div>
            <div className="text-3xl font-bold text-content mt-2 tabular-nums">{pendingSuggestions.length}</div>
            <span className="text-xs text-accent font-semibold">Pending review</span>
          </CardContent>
        </Card>

        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-content-secondary font-semibold uppercase tracking-wider">
              <span>AI confidence avg</span>
              <ShieldCheck className="w-4 h-4 text-accent" />
            </div>
            <div className="text-3xl font-bold text-content mt-2 tabular-nums">
              {suggestions.length > 0
                ? `${Math.round(suggestions.reduce((acc, s) => acc + (s.confidence || 90), 0) / suggestions.length)}%`
                : "100%"}
            </div>
            <span className="text-xs text-success font-semibold">High accuracy tier</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Side-by-Side Merge Cards */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border-subtle">
              <div>
                <CardTitle className="text-base font-bold text-content">Pending duplicate suggestions</CardTitle>
                <CardDescription className="text-xs text-content-secondary font-normal">
                  Review AI-flagged duplicate candidates for <strong className="text-content">{selectedEvent?.name}</strong>.
                </CardDescription>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-surface-raised p-1 rounded-xl border border-border-subtle">
                {(["all", "high", "medium"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-all ${
                      activeFilter === filter
                        ? "bg-accent text-accent-contrast shadow-sm"
                        : "text-content-secondary hover:text-content"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {!taskData ? (
                <div className="py-12 text-center space-y-3 font-normal">
                  <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-content">Run AI analysis</h4>
                  <p className="text-xs text-content-secondary max-w-sm mx-auto">
                    Click &quot;Run one-click AI scan&quot; above to process raw nominations and resolve duplicates.
                  </p>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="py-12 text-center space-y-3 font-normal">
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto opacity-80" />
                  <h4 className="text-sm font-bold text-content">All duplicates resolved</h4>
                  <p className="text-xs text-content-secondary max-w-sm mx-auto">
                    Your nomination list for {selectedEvent?.name} is clean, normalized, and ready for ballot generation.
                  </p>
                </div>
              ) : (
                filteredSuggestions.map((item) => {
                  const sources = (item.sourceNominees as string[]) || [];
                  const primaryNominee = item.suggestedName || sources[0] || "Candidate A";
                  const duplicateNominee = sources[1] || sources[0] || "Candidate B";
                  const isProcessing = actionLoading === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-surface-raised border border-border-subtle space-y-4 hover:border-accent transition-all text-content"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant="default" size="sm">
                          Category: {item.categoryName}
                        </Badge>
                        <Badge
                          variant={item.confidenceTier === "HIGH" ? "success" : "warning"}
                          size="sm"
                        >
                          AI confidence: {item.confidence}% ({item.confidenceTier})
                        </Badge>
                      </div>

                      {/* Side-by-Side Candidate Display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="p-3.5 rounded-xl bg-surface border border-border-subtle space-y-1 shadow-sm">
                          <span className="text-xs uppercase font-bold text-accent block tracking-wider">
                            Primary candidate A
                          </span>
                          <h4 className="text-sm font-bold text-content">{primaryNominee}</h4>
                          <span className="text-xs text-content-secondary font-normal block">
                            Target nominee name
                          </span>
                        </div>

                        <div className="p-3.5 rounded-xl bg-surface border border-border-subtle space-y-1 shadow-sm">
                          <span className="text-xs uppercase font-bold text-accent block tracking-wider">
                            Raw input variant B
                          </span>
                          <h4 className="text-sm font-bold text-content">{duplicateNominee}</h4>
                          <span className="text-xs text-content-secondary font-normal block">
                            {sources.length} raw nomination submission(s)
                          </span>
                        </div>
                      </div>

                      {item.matchReason && (
                        <p className="text-xs text-content-secondary italic bg-surface p-3 rounded-xl border border-border-subtle font-normal">
                          &quot;{item.matchReason}&quot;
                        </p>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-subtle">
                        {isProcessing ? (
                          <Loader2 className="animate-spin w-5 h-5 text-accent" />
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(item.id, primaryNominee, duplicateNominee)}
                              className="rounded-xl font-semibold text-xs"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              <span>Keep separate</span>
                            </Button>

                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(item.id, primaryNominee, duplicateNominee)}
                              className="rounded-xl font-semibold text-xs px-4"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              <span>Approve merge</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Real-time Audit Trail Log */}
        <div className="space-y-4">
          <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
            <CardHeader className="pb-3 border-b border-border-subtle">
              <CardTitle className="text-sm font-bold text-content flex items-center gap-2">
                <History className="w-4 h-4 text-content-secondary" />
                <span>AI cleanup audit log</span>
              </CardTitle>
              <CardDescription className="text-xs text-content-secondary font-normal">Real-time log of AI automated actions and organizer overrides.</CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="space-y-3">
                {approvedSuggestions.length > 0 &&
                  approvedSuggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="p-3.5 rounded-xl bg-surface-raised border border-border-subtle space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="success" size="sm">APPROVED</Badge>
                        <span className="text-xs text-content-secondary font-normal">Database merged</span>
                      </div>
                      <p className="text-content font-bold leading-relaxed">
                        Merged variant into &apos;{sug.suggestedName}&apos;
                      </p>
                    </div>
                  ))}

                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-surface-raised border border-border-subtle space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={log.type === "AUTO" ? "default" : "neutral"} size="sm">
                        {log.type}
                      </Badge>
                      <span className="text-xs text-content-secondary font-normal">{log.time}</span>
                    </div>
                    <p className="text-content font-bold leading-relaxed">{log.action}</p>
                  </div>
                ))}

                {auditLogs.length === 0 && approvedSuggestions.length === 0 && (
                  <div className="text-content-secondary text-xs italic text-center py-6 font-normal">
                    No cleanup actions logged for this event.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

