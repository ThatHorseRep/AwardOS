"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Check,
  X,
  Edit2,
  Trash2,
  Users,
  ShieldCheck,
  History,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AICleanupReviewPage() {
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "high" | "medium">("all");

  const [suggestions, setSuggestions] = useState([
    {
      id: "sug-1",
      categoryName: "Best Student Leader of the Year",
      primaryNominee: "Alex Morgan",
      primaryCount: 28,
      duplicateNominee: "Alexander Morgan",
      duplicateCount: 14,
      confidenceScore: 94,
      confidenceTier: "HIGH",
      reasoning: "Exact nickname match & high string similarity (Alexander ↔ Alex)",
      status: "PENDING",
    },
    {
      id: "sug-2",
      categoryName: "Best Student Leader of the Year",
      primaryNominee: "Dr. Sarah Jenkins",
      primaryCount: 19,
      duplicateNominee: "Sarah Jenkins",
      duplicateCount: 11,
      confidenceScore: 88,
      confidenceTier: "HIGH",
      reasoning: "Title variant match ('Dr.' prefix added to same name)",
      status: "PENDING",
    },
    {
      id: "sug-3",
      categoryName: "Innovation in Tech Award",
      primaryNominee: "EcoTrack App Team",
      primaryCount: 15,
      duplicateNominee: "EcoTrack Smart Campus",
      duplicateCount: 8,
      confidenceScore: 74,
      confidenceTier: "MEDIUM",
      reasoning: "Substantial brand name overlap",
      status: "PENDING",
    },
  ]);

  const [auditLogs, setAuditLogs] = useState([
    { id: "log-1", action: "Merged 'Mc Donald' → 'McDonald'", time: "10 mins ago", type: "AUTO" },
    { id: "log-2", action: "Removed 14 blank/punctuation-only entries", time: "12 mins ago", type: "AUTO" },
  ]);

  const handleApprove = (id: string) => {
    const item = suggestions.find((s) => s.id === id);
    if (!item) return;

    setSuggestions(suggestions.filter((s) => s.id !== id));
    setAuditLogs([
      {
        id: Date.now().toString(),
        action: `Approved Merge: '${item.duplicateNominee}' into '${item.primaryNominee}'`,
        time: "Just now",
        type: "MANUAL",
      },
      ...auditLogs,
    ]);
  };

  const handleReject = (id: string) => {
    const item = suggestions.find((s) => s.id === id);
    if (!item) return;

    setSuggestions(suggestions.filter((s) => s.id !== id));
    setAuditLogs([
      {
        id: Date.now().toString(),
        action: `Rejected Merge: Kept '${item.primaryNominee}' & '${item.duplicateNominee}' separate`,
        time: "Just now",
        type: "MANUAL",
      },
      ...auditLogs,
    ]);
  };

  const handleApproveAllHigh = () => {
    const highItems = suggestions.filter((s) => s.confidenceTier === "HIGH");
    setSuggestions(suggestions.filter((s) => s.confidenceTier !== "HIGH"));
    setAuditLogs([
      {
        id: Date.now().toString(),
        action: `Bulk Approved ${highItems.length} High-Confidence Merges (≥85%)`,
        time: "Just now",
        type: "MANUAL",
      },
      ...auditLogs,
    ]);
  };

  const handleRunCleanup = async () => {
    setIsRunningCleanup(true);
    await new Promise((res) => setTimeout(res, 1200));
    setIsRunningCleanup(false);
  };

  const filteredSuggestions = suggestions.filter((s) => {
    if (activeFilter === "high") return s.confidenceTier === "HIGH";
    if (activeFilter === "medium") return s.confidenceTier === "MEDIUM";
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
            <span>AI Nomination Cleanup Engine</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Automated blank removal, Title Case normalization, and LLM-assisted duplicate nominee resolution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleApproveAllHigh}
            disabled={!suggestions.some((s) => s.confidenceTier === "HIGH")}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Approve All High (≥85%)</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            isLoading={isRunningCleanup}
            onClick={handleRunCleanup}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg shadow-purple-600/25"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Run One-Click AI Scan</span>
          </Button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Blanks & Junk Removed</span>
              <Trash2 className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">14</div>
            <span className="text-[10px] text-slate-500 font-medium">Auto-filtered by AI</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Capitalization Normalized</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">142</div>
            <span className="text-[10px] text-slate-500 font-medium">Title Case & Mc/O&apos; formatted</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Duplicate Flagged</span>
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{suggestions.length}</div>
            <span className="text-[10px] text-purple-400 font-medium">Pending organizer review</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>AI Confidence Avg</span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">91.5%</div>
            <span className="text-[10px] text-emerald-400 font-medium">High Accuracy Tier</span>
          </CardContent>
        </Card>
      </div>

      {/* Main Review Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Side-by-Side Merge Cards */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">Pending Duplicate Suggestions</CardTitle>
                <CardDescription>
                  Review AI-flagged duplicate candidates before generating final voter ballots.
                </CardDescription>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                {(["all", "high", "medium"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase transition-all ${
                      activeFilter === filter
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {filteredSuggestions.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-80" />
                  <h4 className="text-sm font-semibold text-slate-200">All Duplicates Resolved!</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Your nomination list is clean, normalized, and ready for ballot generation.
                  </p>
                </div>
              ) : (
                filteredSuggestions.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="purple" size="sm">
                        Category: {item.categoryName}
                      </Badge>
                      <Badge
                        variant={item.confidenceTier === "HIGH" ? "success" : "warning"}
                        size="sm"
                      >
                        AI Confidence: {item.confidenceScore}% ({item.confidenceTier})
                      </Badge>
                    </div>

                    {/* Side-by-Side Candidate Display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-400 block tracking-wider">
                          Primary Nominee Candidate A
                        </span>
                        <h4 className="text-sm font-bold text-white">{item.primaryNominee}</h4>
                        <span className="text-[11px] text-slate-400 block">
                          {item.primaryCount} nomination votes
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1 relative">
                        <span className="text-[10px] uppercase font-bold text-purple-400 block tracking-wider">
                          Duplicate Candidate B
                        </span>
                        <h4 className="text-sm font-bold text-white">{item.duplicateNominee}</h4>
                        <span className="text-[11px] text-slate-400 block">
                          {item.duplicateCount} nomination votes
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 italic bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                      &quot;{item.reasoning}&quot;
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/60">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReject(item.id)}
                      >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                        <span>Keep Separate</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        className="bg-purple-600 hover:bg-purple-500 border-purple-400/30"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Merge ({item.primaryCount + item.duplicateCount} Total)</span>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Real-time Audit Trail Log */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                <span>AI Cleanup Audit Log</span>
              </CardTitle>
              <CardDescription>Real-time log of AI automated actions and organizer overrides.</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={log.type === "AUTO" ? "purple" : "neutral"} size="sm">
                        {log.type}
                      </Badge>
                      <span className="text-[10px] text-slate-500">{log.time}</span>
                    </div>
                    <p className="text-slate-300 font-medium leading-relaxed">{log.action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
