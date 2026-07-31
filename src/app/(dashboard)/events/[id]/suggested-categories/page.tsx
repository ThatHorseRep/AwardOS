"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  XCircle,
  MessageSquare,
  Loader2,
  Inbox,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getSuggestedCategoriesAction,
  approveSuggestionAction,
  rejectSuggestionAction,
} from "@/actions/nominations";
import { getEventDetailsAction } from "@/actions/events";

export default function SuggestedCategoriesInboxPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // suggestion text being processed

  // Approval Modal/Form State
  const [approvalText, setApprovalText] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const loadData = async () => {
    try {
      const eventData = await getEventDetailsAction(eventId);
      setEvent(eventData);

      const suggestionList = await getSuggestedCategoriesAction(eventId);
      setSuggestions(suggestionList);
    } catch (err) {
      console.error("Failed to load suggested categories page details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  const handleApproveClick = (text: string) => {
    setApprovalText(text);
    setCategoryName(text);
  };

  const handleApproveConfirm = async () => {
    if (!approvalText || !categoryName.trim()) return;
    setActionLoading(approvalText);
    try {
      const response = await approveSuggestionAction(eventId, approvalText, categoryName.trim());
      if (response.success) {
        setApprovalText(null);
        await loadData(); // reload list
      }
    } catch (err) {
      console.error("Failed to approve suggestion:", err);
      alert("Error approving suggestion");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (text: string) => {
    if (!confirm(`Are you sure you want to reject suggestions for "${text}"?`)) return;
    setActionLoading(text);
    try {
      const response = await rejectSuggestionAction(eventId, text);
      if (response.success) {
        await loadData(); // reload list
      }
    } catch (err) {
      console.error("Failed to reject suggestion:", err);
      alert("Error rejecting suggestion");
    } finally {
      setActionLoading(null);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Suggested Categories Inbox</span>
              <Badge variant="purple" size="sm">
                {suggestions.length} Unique
              </Badge>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Review and approve custom categories suggested by guest nominators for <strong className="text-slate-300">{event.name}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Main Inbox content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {suggestions.length === 0 ? (
            <Card className="border-slate-800/80 bg-zinc-950/40 min-h-[300px] flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-500">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Suggested Categories Inbox Empty</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                No custom categories have been suggested by guests yet. Open the nominations stage and share the event link to start collecting suggestions!
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {suggestions.map((sug) => {
                const isProcessing = actionLoading === sug.suggestionText;
                return (
                  <div
                    key={sug.suggestionText}
                    className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700/50 transition-all duration-300"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">{sug.suggestionText}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="info" size="sm">
                          Suggested {sug.count} time{sug.count > 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isProcessing ? (
                        <Loader2 className="animate-spin w-5 h-5 text-indigo-400" />
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                            onClick={() => handleApproveClick(sug.suggestionText)}
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Approve</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500 hover:text-white"
                            onClick={() => handleReject(sug.suggestionText)}
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Panel / Category Setup Sidebar */}
        <div className="space-y-4">
          {approvalText ? (
            <Card className="border-indigo-500/30 bg-indigo-950/10 animate-in fade-in duration-300">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <CardTitle className="text-sm">Approve Category</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Create a new official award category based on user suggestion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Category Name</label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g. Best Student Volunteer"
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
                    onClick={handleApproveConfirm}
                    disabled={!categoryName.trim() || !!actionLoading}
                  >
                    Create & Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white"
                    onClick={() => setApprovalText(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-800 bg-slate-950/20">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <CardTitle className="text-sm">Suggestions Insights</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  How category suggestions work.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 leading-relaxed space-y-2">
                <p>
                  Visitors submit custom category suggestions inline via the public nominations form when they feel something is missing.
                </p>
                <p>
                  Similar suggestions are grouped automatically. Approving a suggestion creates a new official category for the event immediately and updates all matching submission statuses.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
