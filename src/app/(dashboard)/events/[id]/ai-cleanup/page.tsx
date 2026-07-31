"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ListFilter,
  Check,
  X,
  Edit2,
  CheckSquare,
  Square,
  Layers,
  Inbox,
  HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  triggerAICleanupAction,
  getLatestCleanupTaskAction,
  approveMergeSuggestionAction,
  rejectMergeSuggestionAction,
  undoMergeSuggestionAction,
  bulkApproveMergeSuggestionsAction,
} from "@/actions/cleanup";
import { getEventDetailsAction } from "@/actions/events";

export default function AICleanupDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any | null>(null);
  const [taskData, setTaskData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // suggestion ID being processed

  // Filter state
  const [confidenceFilter, setConfidenceFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = async () => {
    try {
      const eventDetails = await getEventDetailsAction(eventId);
      setEvent(eventDetails);

      const latestTask = await getLatestCleanupTaskAction(eventId);
      setTaskData(latestTask);
    } catch (err) {
      console.error("Failed to load AI cleanup task data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const handleRunCleanup = async () => {
    setRunningCleanup(true);
    try {
      const result = await triggerAICleanupAction(eventId);
      if (result.success) {
        await loadData();
        setSelectedIds([]);
      }
    } catch (err: any) {
      console.error("Failed running AI cleanup task:", err);
      alert(err?.message || "Error running AI cleanup.");
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
      alert("Error approving merge");
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
      alert("Error rejecting merge");
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
      alert("Error undoing merge");
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
      alert("Error during bulk approval");
    } finally {
      setRunningCleanup(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (pendingSuggestions: any[]) => {
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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 text-slate-300">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <Link href="/dashboard/events" className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Events
        </Link>
      </div>
    );
  }

  const suggestions = taskData?.suggestions || [];
  const pendingSuggestions = suggestions.filter((s: any) => s.status === "PENDING");
  const approvedSuggestions = suggestions.filter((s: any) => s.status === "APPROVED");

  const filteredSuggestions = suggestions.filter((s: any) => {
    if (confidenceFilter === "ALL") return true;
    return s.confidenceTier === confidenceFilter;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>AI Nomination Cleanup Hub</span>
              <Badge variant="purple" size="sm">
                Active
              </Badge>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Analyze incoming nominations to remove empty strings, fix casing, and resolve duplicate names.
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleRunCleanup}
          disabled={runningCleanup}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-xl shadow-indigo-600/10 gap-1.5 flex items-center"
        >
          {runningCleanup ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{taskData ? "Re-run AI Analysis" : "Run AI Cleanup"}</span>
        </Button>
      </div>

      {/* Overview Stats */}
      {taskData?.task && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="border-slate-800bg-slate-950/20">
            <CardContent className="pt-6">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Blank Removed</span>
              <div className="text-2xl font-bold text-white mt-1">
                {taskData.task.stats?.blankRemovedCount || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-950/20">
            <CardContent className="pt-6">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Casing Normalized</span>
              <div className="text-2xl font-bold text-white mt-1">
                {taskData.task.stats?.normalizedCount || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-950/20">
            <CardContent className="pt-6">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Merge Recommendations</span>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {pendingSuggestions.length} Pending
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-950/20">
            <CardContent className="pt-6">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Last Analyzed</span>
              <div className="text-xs text-slate-300 mt-2 font-mono">
                {new Date(taskData.task.completedAt || taskData.task.createdAt).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main merge review console */}
      {!taskData ? (
        <Card className="border-slate-800/80 bg-zinc-950/40 min-h-[300px] flex flex-col items-center justify-center text-center p-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-purple-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Deduplicate Nominations with AI</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Launch our AI agent to cluster duplicate nominations and fix typographical mistakes across your active award categories.
          </p>
          <Button variant="primary" size="sm" className="mt-6" onClick={handleRunCleanup} disabled={runningCleanup}>
            {runningCleanup ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
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
                  className="cursor-pointer bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  onClick={() => setConfidenceFilter("HIGH")}
                >
                  High Confidence
                </Badge>
                <Badge
                  variant={confidenceFilter === "MEDIUM" ? "purple" : "default"}
                  className="cursor-pointer bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  onClick={() => setConfidenceFilter("MEDIUM")}
                >
                  Medium Confidence
                </Badge>
              </div>

              {pendingSuggestions.length > 0 && (
                <button
                  onClick={() => toggleSelectAll(pendingSuggestions)}
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1.5"
                >
                  {selectedIds.length === pendingSuggestions.length ? "Deselect All" : "Select All Pending"}
                </button>
              )}
            </div>

            {filteredSuggestions.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/10 text-center py-12 text-slate-500 text-xs">
                No duplicate merge recommendations match the active filter.
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredSuggestions.map((sug: any) => {
                  const isPending = sug.status === "PENDING";
                  const isApproved = sug.status === "APPROVED";
                  const isRejected = sug.status === "REJECTED";
                  const isProcessing = actionLoading === sug.id;
                  const isSelected = selectedIds.includes(sug.id);

                  return (
                    <div
                      key={sug.id}
                      className={`p-5 rounded-2xl border transition-all duration-300 ${
                        isApproved
                          ? "bg-emerald-950/5 border-emerald-500/20"
                          : isRejected
                          ? "bg-slate-900/20 border-slate-800 opacity-60"
                          : "bg-slate-900/40 border-slate-800 hover:border-slate-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {isPending && (
                            <button
                              onClick={() => toggleSelect(sug.id)}
                              className="mt-1 text-slate-500 hover:text-white"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-500" />
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
                              {isApproved && <Badge variant="success">Merged</Badge>}
                              {isRejected && <Badge variant="default">Rejected</Badge>}
                            </div>

                            {/* Standardized target name display */}
                            {editingId === sug.id ? (
                              <div className="flex items-center gap-2 pt-1.5">
                                <input
                                  type="text"
                                  value={editedName}
                                  onChange={(e) => setEditedName(e.target.value)}
                                  className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                />
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => handleApprove(sug.id, editedName)}
                                >
                                  Save & Merge
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-slate-400"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 pt-0.5">
                                <span>Suggested: {sug.suggestedName}</span>
                                {isPending && (
                                  <button
                                    onClick={() => {
                                      setEditingId(sug.id);
                                      setEditedName(sug.suggestedName);
                                    }}
                                    className="text-slate-500 hover:text-white"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </h4>
                            )}

                            {/* List of raw duplicate strings matching */}
                            <div className="text-[11px] text-slate-400 pt-1.5 space-y-1">
                              <span className="text-slate-500">Duplicate inputs:</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {sug.sourceNominees.map((src: string) => (
                                  <Badge key={src} variant="default" size="sm" className="bg-slate-800 text-slate-300">
                                    {src}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 italic mt-1">{sug.matchReason}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isProcessing ? (
                            <Loader2 className="animate-spin w-5 h-5 text-indigo-400" />
                          ) : (
                            <>
                              {isPending && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleApprove(sug.id)}
                                    className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Accept</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReject(sug.id)}
                                    className="bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Reject</span>
                                  </Button>
                                </div>
                              )}

                              {isApproved && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUndo(sug.id)}
                                  className="text-slate-400 hover:text-white hover:bg-slate-800"
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
            <Card className="border-slate-800 bg-slate-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <CardTitle className="text-sm font-bold">AI Deduplication Tips</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 leading-relaxed space-y-3">
                <p>
                  Our AI engine scans all incoming guest nominations, normalizes text casing (e.g. converting <code className="text-indigo-400">JANE DOE</code> to <code className="text-indigo-400">Jane Doe</code>), and uses fuzzy string metrics alongside LLMs to group close match entries.
                </p>
                <p>
                  Approving a suggestion inserts the nominee as an official candidate for that category and redirects all matching submissions to point to it, ensuring precise tally computation.
                </p>
              </CardContent>
            </Card>

            {/* Audit log trail widget */}
            <Card className="border-slate-800 bg-slate-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <CardTitle className="text-sm font-bold">Audit History</CardTitle>
                </div>
                <CardDescription className="text-[10px]">
                  Recent actions and cleanups executed.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs space-y-3 max-h-[200px] overflow-y-auto">
                {approvedSuggestions.length === 0 ? (
                  <span className="text-slate-500 italic block">No merge operations finalized yet.</span>
                ) : (
                  <div className="space-y-2">
                    {approvedSuggestions.map((sug: any) => (
                      <div key={sug.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Merge Success</span>
                          <span>Approved</span>
                        </div>
                        <p className="text-slate-300 font-semibold">{sug.suggestedName}</p>
                        <span className="text-[10px] text-slate-500 block">
                          Merged {sug.sourceNominees.length} raw spelling variations.
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700/80 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-300 z-50">
          <span className="text-xs text-slate-300 font-medium">
            {selectedIds.length} merge recommendation{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkApprove}
              disabled={runningCleanup}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Approve Merges
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
