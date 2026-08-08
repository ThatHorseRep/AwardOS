"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Check,
  X,
  Trash2,
  Users,
  ShieldCheck,
  History,
  Loader2,
  Calendar,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventsAction } from "@/actions/events";
import { useToast } from "@/components/ui/toast";
import {
  triggerAICleanupAction,
  getLatestCleanupTaskAction,
  approveMergeSuggestionAction,
  rejectMergeSuggestionAction,
  bulkApproveMergeSuggestionsAction,
} from "@/actions/cleanup";

export default function AICleanupReviewPage() {
  const toast = useToast();
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [taskData, setTaskData] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "high" | "medium">("all");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Load events list on mount
  useEffect(() => {
    async function loadEvents() {
      try {
        const events = await getEventsAction();
        setEventsList(events || []);
        if (events && events.length > 0) {
          setSelectedEventId(events[0].id);
        }
      } catch (err) {
        console.error("Failed to load events for AI cleanup review:", err);
      } finally {
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  // Fetch task data when selectedEventId changes
  const loadTaskData = async (eventId: string) => {
    if (!eventId) return;
    try {
      const data = await getLatestCleanupTaskAction(eventId);
      setTaskData(data);
    } catch (err) {
      console.error("Failed to load cleanup task for event:", err);
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
    } catch (err: any) {
      console.error("Error triggering AI cleanup:", err);
      toast.error(err.message || "Failed to run AI cleanup scan.");
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
    } catch (err: any) {
      console.error("Error approving merge:", err);
      toast.error(err.message || "Failed to approve merge.");
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
    } catch (err: any) {
      console.error("Error rejecting merge:", err);
      toast.error(err.message || "Failed to reject merge.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAllHigh = async () => {
    const suggestions = taskData?.suggestions || [];
    const highPending = suggestions.filter(
      (s: any) => s.status === "PENDING" && s.confidenceTier === "HIGH"
    );
    if (highPending.length === 0) return;

    setIsRunningCleanup(true);
    try {
      const ids = highPending.map((s: any) => s.id);
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
    } catch (err: any) {
      console.error("Error bulk approving merges:", err);
      toast.error(err.message || "Bulk approval failed.");
    } finally {
      setIsRunningCleanup(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-purple-600" />
      </div>
    );
  }

  if (eventsList.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4 font-sans select-none">
        <Card className="border-slate-200/80 bg-white rounded-3xl p-8 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 border border-purple-200">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Award Events Available</h2>
          <p className="text-xs text-slate-600 font-medium max-w-sm mx-auto leading-relaxed">
            Create an award event and collect nominations to utilize the AI Nomination Cleanup Engine.
          </p>
          <div className="pt-2">
            <Link href="/events/new">
              <Button className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 shadow-md shadow-blue-600/20">
                Create First Event
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const suggestions = taskData?.suggestions || [];
  const pendingSuggestions = suggestions.filter((s: any) => s.status === "PENDING");
  const approvedSuggestions = suggestions.filter((s: any) => s.status === "APPROVED");

  const filteredSuggestions = pendingSuggestions.filter((s: any) => {
    if (activeFilter === "high") return s.confidenceTier === "HIGH";
    if (activeFilter === "medium") return s.confidenceTier === "MEDIUM";
    return true;
  });

  const selectedEvent = eventsList.find((e) => e.id === selectedEventId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans select-none pb-16">
      {/* Header Bar & Event Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
            <span>AI Nomination Cleanup Engine</span>
          </h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Automated blank removal, Title Case normalization, and LLM-assisted duplicate nominee resolution.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Event Selector Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
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
            disabled={!pendingSuggestions.some((s: any) => s.confidenceTier === "HIGH") || isRunningCleanup}
            className="rounded-full bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" />
            <span>Approve All High (≥85%)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            disabled={isRunningCleanup}
            onClick={handleRunCleanup}
            className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 shadow-md shadow-purple-600/20"
          >
            {isRunningCleanup ? (
              <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            <span>{taskData ? "Re-run AI Scan" : "Run One-Click AI Scan"}</span>
          </Button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
              <span>Blanks & Junk Removed</span>
              <Trash2 className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {taskData?.task?.stats?.blankRemovedCount || 0}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Auto-filtered by AI</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
              <span>Capitalization Normalized</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {taskData?.task?.stats?.normalizedCount || 0}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Title Case & Mc/O&apos; formatted</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
              <span>Duplicate Flagged</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">{pendingSuggestions.length}</div>
            <span className="text-[10px] text-purple-600 font-bold">Pending organizer review</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
              <span>AI Confidence Avg</span>
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {suggestions.length > 0
                ? `${Math.round(suggestions.reduce((acc: number, s: any) => acc + (s.confidence || 90), 0) / suggestions.length)}%`
                : "100%"}
            </div>
            <span className="text-[10px] text-emerald-600 font-bold">High Accuracy Tier</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Side-by-Side Merge Cards */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-100">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Pending Duplicate Suggestions</CardTitle>
                <CardDescription className="text-xs text-slate-600 font-medium">
                  Review AI-flagged duplicate candidates for <strong className="text-slate-800">{selectedEvent?.name}</strong>.
                </CardDescription>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200">
                {(["all", "high", "medium"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      activeFilter === filter
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {!taskData ? (
                <div className="py-12 text-center space-y-3 font-medium">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Run AI Analysis</h4>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    Click &quot;Run One-Click AI Scan&quot; above to process raw nominations and resolve duplicates.
                  </p>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="py-12 text-center space-y-3 font-medium">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto opacity-80" />
                  <h4 className="text-sm font-bold text-slate-900">All Duplicates Resolved!</h4>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    Your nomination list for {selectedEvent?.name} is clean, normalized, and ready for ballot generation.
                  </p>
                </div>
              ) : (
                filteredSuggestions.map((item: any) => {
                  const sources = (item.sourceNominees as string[]) || [];
                  const primaryNominee = item.suggestedName || sources[0] || "Candidate A";
                  const duplicateNominee = sources[1] || sources[0] || "Candidate B";
                  const isProcessing = actionLoading === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4 hover:border-purple-300 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant="purple" size="sm">
                          Category: {item.categoryName}
                        </Badge>
                        <Badge
                          variant={item.confidenceTier === "HIGH" ? "success" : "warning"}
                          size="sm"
                        >
                          AI Confidence: {item.confidence}% ({item.confidenceTier})
                        </Badge>
                      </div>

                      {/* Side-by-Side Candidate Display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
                          <span className="text-[10px] uppercase font-extrabold text-blue-600 block tracking-wider">
                            Primary Candidate A
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{primaryNominee}</h4>
                          <span className="text-[11px] text-slate-500 font-medium block">
                            Target nominee name
                          </span>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1 shadow-sm">
                          <span className="text-[10px] uppercase font-extrabold text-purple-600 block tracking-wider">
                            Raw Input Variant B
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{duplicateNominee}</h4>
                          <span className="text-[11px] text-slate-500 font-medium block">
                            {sources.length} raw nomination submission(s)
                          </span>
                        </div>
                      </div>

                      {item.matchReason && (
                        <p className="text-xs text-slate-600 italic bg-white p-3 rounded-2xl border border-slate-200 font-medium">
                          &quot;{item.matchReason}&quot;
                        </p>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                        {isProcessing ? (
                          <Loader2 className="animate-spin w-5 h-5 text-purple-600" />
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleReject(item.id, primaryNominee, duplicateNominee)}
                              className="rounded-full bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              <span>Keep Separate</span>
                            </Button>

                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(item.id, primaryNominee, duplicateNominee)}
                              className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              <span>Approve Merge</span>
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
          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <span>AI Cleanup Audit Log</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">Real-time log of AI automated actions and organizer overrides.</CardDescription>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="space-y-3">
                {approvedSuggestions.length > 0 &&
                  approvedSuggestions.map((sug: any) => (
                    <div
                      key={sug.id}
                      className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="success" size="sm">APPROVED</Badge>
                        <span className="text-[10px] text-slate-500 font-medium">Database Merged</span>
                      </div>
                      <p className="text-slate-900 font-bold leading-relaxed">
                        Merged variant into &apos;{sug.suggestedName}&apos;
                      </p>
                    </div>
                  ))}

                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={log.type === "AUTO" ? "purple" : "neutral"} size="sm">
                        {log.type}
                      </Badge>
                      <span className="text-[10px] text-slate-500 font-medium">{log.time}</span>
                    </div>
                    <p className="text-slate-900 font-bold leading-relaxed">{log.action}</p>
                  </div>
                ))}

                {auditLogs.length === 0 && approvedSuggestions.length === 0 && (
                  <div className="text-slate-500 text-xs italic text-center py-6 font-medium">
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
