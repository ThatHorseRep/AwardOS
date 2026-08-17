"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  RotateCcw,
  Loader2,
  Check,
  X,
  Edit2,
  CheckSquare,
  Square,
  Layers,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  triggerAICleanupAction,
  getLatestCleanupTaskAction,
  approveMergeSuggestionAction,
  rejectMergeSuggestionAction,
  undoMergeSuggestionAction,
  bulkApproveMergeSuggestionsAction,
  bulkRejectMergeSuggestionsAction,
  retryLatestCleanupTaskAction,
} from "@/actions/cleanup";
import { getEventDetailsAction } from "@/actions/events";
import { LoadError } from "@/components/shared/load-error";

import { useToast } from "@/components/ui/toast";

type EventDetails = Awaited<ReturnType<typeof getEventDetailsAction>>;
type CleanupTask = Awaited<ReturnType<typeof getLatestCleanupTaskAction>>;
type CleanupSuggestion = NonNullable<CleanupTask>["suggestions"][number];
type CleanupStats = {
  blankRemovedCount?: number;
  normalizedCount?: number;
  batchesCompleted?: number;
  batchesTotal?: number;
  errorMessage?: string;
};
type SourceNominees = string[];

export default function AICleanupDashboardPage() {
  const toast = useToast();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventDetails>(null);
  const [taskData, setTaskData] = useState<CleanupTask>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [confidenceFilter, setConfidenceFilter] = useState<
    "ALL" | "HIGH" | "MEDIUM" | "LOW"
  >("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const eventDetails = await getEventDetailsAction(eventId);
      setEvent(eventDetails);

      const latestTask = await getLatestCleanupTaskAction(eventId);
      setTaskData(latestTask);
    } catch (err) {
      console.error("Failed to load AI cleanup task data:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (taskData?.task.status !== "PROCESSING") return;
    const timer = window.setInterval(() => void loadData(), 2000);
    return () => window.clearInterval(timer);
  }, [loadData, taskData?.task.status]);

  if (loadError) return <LoadError onRetry={() => void loadData()} />;

  const handleRunCleanup = async () => {
    setRunningCleanup(true);
    try {
      const result = await triggerAICleanupAction(eventId);
      if (result.success) {
        await loadData();
        setSelectedIds([]);
      }
    } catch (err: unknown) {
      console.error("Failed running AI cleanup task:", err);
      toast.error(
        err instanceof Error ? err.message : "Error running AI cleanup.",
      );
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleApprove = async (id: string, customName?: string) => {
    setActionLoading(id);
    try {
      const result = await approveMergeSuggestionAction(id, customName);
      if (result.success) {
        setEditingId(null);
        await loadData();
      }
    } catch (err) {
      console.error("Approve merge failed:", err);
      toast.error("Error approving merge");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await rejectMergeSuggestionAction(id);
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Reject merge failed:", err);
      toast.error("Error rejecting merge");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUndo = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await undoMergeSuggestionAction(id);
      if (result.success) {
        await loadData();
      }
    } catch (err) {
      console.error("Undo merge failed:", err);
      toast.error("Error undoing merge");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setRunningCleanup(true);
    try {
      const result = await bulkApproveMergeSuggestionsAction(selectedIds);
      if (result.success) {
        setSelectedIds([]);
        await loadData();
      }
    } catch (err) {
      console.error("Bulk approval failed:", err);
      toast.error("Error during bulk approval");
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    setRunningCleanup(true);
    try {
      await bulkRejectMergeSuggestionsAction(selectedIds);
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      console.error("Bulk rejection failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Error during bulk rejection",
      );
    } finally {
      setRunningCleanup(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = (pendingSuggestions: CleanupSuggestion[]) => {
    const pendingIds = pendingSuggestions.map((s) => s.id);
    if (selectedIds.length === pendingIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingIds);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-900">Event not found</h2>
        <Link
          href="/events"
          className="mt-4 inline-block text-blue-600 hover:underline font-bold"
        >
          Back to Events
        </Link>
      </div>
    );
  }

  const suggestions = taskData?.suggestions || [];
  const taskStatus = taskData?.task.status;
  const pendingSuggestions = suggestions.filter((s) => s.status === "PENDING");
  const approvedSuggestions = suggestions.filter(
    (s) => s.status === "APPROVED",
  );

  const filteredSuggestions = suggestions.filter((s) => {
    if (confidenceFilter === "ALL") return true;
    return s.confidenceTier === confidenceFilter;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans pb-16 select-none">
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button
              variant="ghost"
              size="icon"
              className="mt-1 text-slate-700 hover:bg-slate-200"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>AI Nomination Cleanup Hub</span>
              <Badge variant="purple" size="sm">
                Active
              </Badge>
            </h1>
            <p className="text-slate-600 text-xs mt-1 font-medium">
              Analyze incoming nominations to remove empty strings, fix casing,
              and resolve duplicate names.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleRunCleanup}
          disabled={runningCleanup}
          className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5"
        >
          {runningCleanup ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{taskData ? "Re-run AI Analysis" : "Run AI Cleanup"}</span>
        </Button>
      </div>

      {taskStatus === "FAILED" && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-semibold text-destructive">
              Cleanup did not finish
            </p>
            <p className="mt-1 text-sm text-content-secondary">
              {(taskData?.task.stats as CleanupStats | null)?.errorMessage ??
                "No suggestions from this run were applied. Retry the analysis when you are ready."}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={runningCleanup}
            onClick={async () => {
              setRunningCleanup(true);
              try {
                await retryLatestCleanupTaskAction(eventId);
                await loadData();
              } catch (cause) {
                toast.error(
                  cause instanceof Error
                    ? cause.message
                    : "Cleanup retry failed.",
                );
              } finally {
                setRunningCleanup(false);
              }
            }}
          >
            Retry cleanup
          </Button>
        </div>
      )}
      {taskStatus === "PROCESSING" && (
        <div
          role="status"
          className="rounded-lg border border-accent/30 bg-accent/10 p-4"
        >
          <p className="font-semibold">Cleanup is processing</p>
          <p className="mt-1 text-sm text-content-secondary">
            Batch{" "}
            {(taskData?.task.stats as CleanupStats | null)?.batchesCompleted ??
              0}{" "}
            of{" "}
            {(taskData?.task.stats as CleanupStats | null)?.batchesTotal ?? 1}.
            The review queue will appear after every batch has completed.
          </p>
        </div>
      )}

      {/* Overview Stats */}
      {taskData?.task && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">
              Blank Removed
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {(taskData.task.stats as CleanupStats | null)
                ?.blankRemovedCount || 0}
            </div>
          </div>
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">
              Casing Normalized
            </span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {(taskData.task.stats as CleanupStats | null)?.normalizedCount ||
                0}
            </div>
          </div>
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">
              Merge Recommendations
            </span>
            <div className="text-2xl font-extrabold text-blue-600 mt-1">
              {pendingSuggestions.length} Pending
            </div>
          </div>
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
            <span className="text-[10px] text-slate-500 uppercase block font-bold">
              Last Analyzed
            </span>
            <div className="text-xs text-slate-700 mt-2 font-mono font-medium">
              {new Date(
                taskData.task.completedAt || taskData.task.createdAt,
              ).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Main merge review console */}
      {!taskData ? (
        <Card className="border-slate-200/80 bg-white rounded-3xl min-h-[300px] flex flex-col items-center justify-center text-center p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4 text-blue-600">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Deduplicate Nominations with AI
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-sm font-medium">
            Launch our AI engine to cluster duplicate nominations and fix
            typographical mistakes across your active award categories.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold"
            onClick={handleRunCleanup}
            disabled={runningCleanup}
          >
            {runningCleanup ? (
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
            ) : null}
            <span>Run Initial AI Analysis</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Inbox area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant={confidenceFilter === "ALL" ? "purple" : "default"}
                  className="cursor-pointer"
                  onClick={() => setConfidenceFilter("ALL")}
                >
                  All ({suggestions.length})
                </Badge>
                <Badge
                  variant={confidenceFilter === "HIGH" ? "purple" : "default"}
                  className="cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                  onClick={() => setConfidenceFilter("HIGH")}
                >
                  High Confidence
                </Badge>
                <Badge
                  variant={confidenceFilter === "MEDIUM" ? "purple" : "default"}
                  className="cursor-pointer bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                  onClick={() => setConfidenceFilter("MEDIUM")}
                >
                  Medium Confidence
                </Badge>
              </div>

              {pendingSuggestions.length > 0 && (
                <button
                  onClick={() => toggleSelectAll(pendingSuggestions)}
                  className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1.5"
                >
                  {selectedIds.length === pendingSuggestions.length
                    ? "Deselect All"
                    : "Select All Pending"}
                </button>
              )}
            </div>

            {filteredSuggestions.length === 0 ? (
              <Card className="border-slate-200/80 bg-white rounded-3xl text-center py-12 text-slate-500 text-xs shadow-sm font-medium">
                No duplicate merge recommendations match the active filter.
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredSuggestions.map((sug) => {
                  const isPending = sug.status === "PENDING";
                  const isApproved = sug.status === "APPROVED";
                  const isRejected = sug.status === "REJECTED";
                  const isProcessing = actionLoading === sug.id;
                  const isSelected = selectedIds.includes(sug.id);

                  return (
                    <div
                      key={sug.id}
                      className={`p-5 rounded-3xl border transition-all duration-300 ${
                        isApproved
                          ? "bg-emerald-50/60 border-emerald-200"
                          : isRejected
                            ? "bg-slate-50 border-slate-200 opacity-60"
                            : "bg-white border-slate-200/80 shadow-sm hover:border-blue-500/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {isPending && (
                            <button
                              onClick={() => toggleSelect(sug.id)}
                              className="mt-1 text-slate-400 hover:text-slate-900"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                {sug.categoryName}
                              </span>
                              <Badge
                                variant={
                                  sug.confidenceTier === "HIGH"
                                    ? "success"
                                    : sug.confidenceTier === "MEDIUM"
                                      ? "warning"
                                      : "default"
                                }
                                size="sm"
                              >
                                {sug.confidence}% Match
                              </Badge>
                              {isApproved && (
                                <Badge variant="success">Merged</Badge>
                              )}
                              {isRejected && (
                                <Badge variant="default">Rejected</Badge>
                              )}
                            </div>

                            {/* Standardized target name display */}
                            {editingId === sug.id ? (
                              <div className="flex items-center gap-2 pt-1.5">
                                <input
                                  type="text"
                                  value={editedName}
                                  onChange={(e) =>
                                    setEditedName(e.target.value)
                                  }
                                  className="bg-slate-50 text-slate-900 text-xs px-3 py-1.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-500 font-medium"
                                />
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-8 rounded-full bg-blue-600 text-white font-bold"
                                  onClick={() =>
                                    handleApprove(sug.id, editedName)
                                  }
                                >
                                  Save & Merge
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-slate-600"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pt-0.5">
                                <span>Suggested: {sug.suggestedName}</span>
                                {isPending && (
                                  <button
                                    onClick={() => {
                                      setEditingId(sug.id);
                                      setEditedName(sug.suggestedName);
                                    }}
                                    className="text-slate-400 hover:text-slate-900"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </h4>
                            )}

                            {/* List of raw duplicate strings matching */}
                            <div className="text-[11px] text-slate-600 pt-1.5 space-y-1 font-medium">
                              <span className="text-slate-500">
                                Duplicate inputs:
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(sug.sourceNominees as SourceNominees).map(
                                  (src) => (
                                    <Badge
                                      key={src}
                                      variant="default"
                                      size="sm"
                                      className="bg-slate-100 text-slate-700 border border-slate-200"
                                    >
                                      {src}
                                    </Badge>
                                  ),
                                )}
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 italic mt-1 font-medium">
                              {sug.matchReason}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isProcessing ? (
                            <Loader2 className="animate-spin w-5 h-5 text-blue-600" />
                          ) : (
                            <>
                              {isPending && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleApprove(sug.id)}
                                    className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white font-bold"
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    <span>Accept</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(sug.id)}
                                    className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-600 hover:text-white font-bold"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" />
                                    <span>Reject</span>
                                  </Button>
                                </div>
                              )}

                              {isApproved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUndo(sug.id)}
                                  className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                  <span>Undo</span>
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar / Instructions panel */}
          <div className="space-y-4">
            <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    AI Deduplication Tips
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed space-y-3 pt-3 font-medium">
                <p>
                  Our AI engine scans all incoming guest nominations, normalizes
                  text casing (e.g. converting{" "}
                  <code className="text-blue-600">JANE DOE</code> to{" "}
                  <code className="text-blue-600">Jane Doe</code>), and uses
                  fuzzy string metrics alongside LLMs to group close match
                  entries.
                </p>
                <p>
                  Approving a suggestion inserts the nominee as an official
                  candidate for that category and redirects all matching
                  submissions to point to it, ensuring precise tally
                  computation.
                </p>
              </CardContent>
            </Card>

            {/* Audit log trail widget */}
            <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Audit History
                  </CardTitle>
                </div>
                <CardDescription className="text-[10px] text-slate-500 font-medium">
                  Recent actions and cleanups executed.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-3 max-h-[200px] overflow-y-auto pt-3">
                {approvedSuggestions.length === 0 ? (
                  <span className="text-slate-500 italic block font-medium">
                    No merge operations finalized yet.
                  </span>
                ) : (
                  <div className="space-y-2">
                    {approvedSuggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                          <span>Merge Success</span>
                          <span className="font-bold text-emerald-600">
                            Approved
                          </span>
                        </div>
                        <p className="text-slate-900 font-bold">
                          {sug.suggestedName}
                        </p>
                        <span className="text-[10px] text-slate-500 block font-medium">
                          Merged {(sug.sourceNominees as SourceNominees).length}{" "}
                          raw spelling variations.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Drawer */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white border border-slate-800 rounded-full px-6 py-3.5 flex items-center gap-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 z-50">
          <span className="text-xs font-semibold">
            {selectedIds.length} merge recommendation
            {selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkApprove}
              disabled={runningCleanup}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Approve Merges
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkReject}
              disabled={runningCleanup}
              className="text-rose-300 hover:bg-rose-950 hover:text-rose-100"
            >
              Reject
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
