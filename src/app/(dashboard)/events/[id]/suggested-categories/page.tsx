"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles, CheckCircle, XCircle, MessageSquare, Loader2, Inbox } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSuggestedCategoriesAction, approveSuggestionAction, rejectSuggestionAction } from "@/actions/nominations";
import { getEventDetailsAction } from "@/actions/events";
import { LoadError } from "@/components/shared/load-error";

import { useToast } from "@/components/ui/toast";
export default function SuggestedCategoriesInboxPage() {
  const toast = useToast();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Awaited<ReturnType<typeof getEventDetailsAction>> | null>(null);
  const [suggestions, setSuggestions] = useState<Awaited<ReturnType<typeof getSuggestedCategoriesAction>>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Approval Modal/Form State
  const [approvalText, setApprovalText] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const eventData = await getEventDetailsAction(eventId);
      setEvent(eventData);

      const suggestionList = await getSuggestedCategoriesAction(eventId);
      setSuggestions(suggestionList);
    } catch (err) {
      console.error("Failed to load suggested categories page details:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loadError) return <LoadError onRetry={() => void loadData()} />;

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
        setSuggestions((current) => current.filter((suggestion) => suggestion.suggestionText !== approvalText));
        setApprovalText(null);
        toast.success("Category suggestion approved.");
      }
    } catch (err) {
      console.error("Failed to approve suggestion:", err);
      toast.error("Error approving suggestion");
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
        setSuggestions((current) => current.filter((suggestion) => suggestion.suggestionText !== text));
        toast.success("Category suggestion rejected.");
      }
    } catch (err) {
      console.error("Failed to reject suggestion:", err);
      toast.error("Error rejecting suggestion");
    } finally {
      setActionLoading(null);
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
      <div className="text-center py-12 font-sans select-none">
        <h2 className="text-xl font-bold text-slate-900">Event not found</h2>
        <Link href="/events" className="mt-4 inline-block text-blue-600 hover:underline font-bold">
          Back to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans select-none pb-16">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" aria-label="Back to event" className="mt-1 text-slate-700 hover:bg-slate-200">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Suggested Categories Inbox</span>
              <Badge variant="purple" size="sm">
                {suggestions.length} Unique
              </Badge>
            </h1>
            <p className="text-slate-600 text-xs mt-1 font-medium">
              Review and approve custom categories suggested by guest nominators for <strong className="text-slate-900">{event.name}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Main Inbox content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {suggestions.length === 0 ? (
            <Card className="border-slate-200/80 bg-white rounded-3xl min-h-[300px] flex flex-col items-center justify-center text-center p-8 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center mb-4">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Suggested Categories Inbox Empty</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm font-medium">
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
                    className="p-5 rounded-3xl bg-white border border-slate-200/80 flex items-center justify-between gap-4 hover:border-purple-300 shadow-sm transition-all duration-200"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-900">{sug.suggestionText}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="purple" size="sm">
                          Suggested {sug.count} time{sug.count > 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isProcessing ? (
                        <Loader2 className="animate-spin w-5 h-5 text-blue-600" />
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-600 hover:text-white font-bold rounded-full"
                            onClick={() => handleApproveClick(sug.suggestionText)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            <span>Approve</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-600 hover:text-white font-bold rounded-full"
                            onClick={() => handleReject(sug.suggestionText)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
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
            <Card className="border-purple-200 bg-purple-50/50 rounded-3xl shadow-sm animate-in fade-in duration-300">
              <CardHeader className="border-b border-purple-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">Approve Category</CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-600 font-medium">
                  Create a new official award category based on user suggestion.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label htmlFor="approved-category-name" className="text-xs font-semibold text-slate-700">Category Name</label>
                  <Input
                    id="approved-category-name"
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g. Best Student Volunteer"
                    className="rounded-2xl bg-white text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/20"
                    onClick={handleApproveConfirm}
                    disabled={!categoryName.trim() || !!actionLoading}
                  >
                    Create & Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 hover:text-slate-900 font-medium"
                    onClick={() => setApprovalText(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <CardTitle className="text-sm font-bold text-slate-900">Suggestions Insights</CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-600 font-medium">
                  How category suggestions work.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-slate-600 leading-relaxed space-y-2 pt-4 font-medium">
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
