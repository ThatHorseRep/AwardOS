"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UserCheck,
  Sparkles,
  Search,
  Check,
  X,
  Download,
  MessageSquare,
  Eye,
  Loader2,
  Inbox,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getWorkspaceNominationsAction,
  approveSuggestionAction,
  rejectSuggestionAction,
} from "@/actions/nominations";
import { LoadError } from "@/components/shared/load-error";

export default function OrganizerNominationsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  type WorkspaceNominations = Awaited<ReturnType<typeof getWorkspaceNominationsAction>>;
  const [rawNominations, setRawNominations] = useState<WorkspaceNominations["rawNominations"]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<WorkspaceNominations["suggestedCategories"]>([]);
  const [activeTab, setActiveTab] = useState<"stream" | "suggested">("stream");
  const [searchQuery, setSearchQuery] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true); setLoadError(false);
    try {
      const data = await getWorkspaceNominationsAction();
      setRawNominations(data.rawNominations);
      setSuggestedCategories(data.suggestedCategories);
    } catch (err) {
      console.error("Failed to load nominations inbox:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (eventId: string, suggestionText: string) => {
    setActioningId(suggestionText);
    try {
      await approveSuggestionAction(eventId, suggestionText, suggestionText);
      await loadData();
    } catch (err) {
      console.error("Failed to approve category:", err);
      toast.error("Error approving category.");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (eventId: string, suggestionText: string) => {
    setActioningId(suggestionText);
    try {
      await rejectSuggestionAction(eventId, suggestionText);
      await loadData();
    } catch (err) {
      console.error("Failed to reject suggestion:", err);
      toast.error("Error rejecting suggestion.");
    } finally {
      setActioningId(null);
    }
  };

  const filteredNomList = rawNominations.filter(
    (n) =>
      n.nomineeText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.eventTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }
  if (loadError) return <LoadError onRetry={() => void loadData()} />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16 select-none animate-page-entrance text-content">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
            <span>Nominations & category inbox</span>
            <Badge variant="default" size="sm">
              {rawNominations.length} submissions
            </Badge>
          </h1>
          <p className="text-content-secondary text-xs mt-1 font-normal">
            Review raw guest nominations and approve suggested category submissions from event visitors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs">
            <Download className="w-4 h-4 mr-1.5" />
            <span>Export CSV</span>
          </Button>

          <Link href="/voting">
            <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs">
              <Eye className="w-4 h-4 mr-1.5" />
              <span>Voting hub</span>
            </Button>
          </Link>

          <Link href="/cleanup">
            <Button variant="primary" size="sm" className="rounded-xl font-semibold text-xs px-4">
              <Sparkles className="w-4 h-4 mr-1.5" />
              <span>AI cleanup</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab("stream")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
            activeTab === "stream"
              ? "text-accent border-accent bg-accent/10"
              : "text-content-secondary border-transparent hover:text-content hover:bg-surface-raised"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Raw nominations stream ({rawNominations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("suggested")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
            activeTab === "suggested"
              ? "text-accent border-accent bg-accent/10"
              : "text-content-secondary border-transparent hover:text-content hover:bg-surface-raised"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Suggested categories ({suggestedCategories.length})</span>
        </button>
      </div>

      {/* Tab 1: Raw Nominations Stream */}
      {activeTab === "stream" && (
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-4 border-b border-border-subtle">
            <div>
              <CardTitle className="text-base font-bold text-content">Incoming nominations stream</CardTitle>
              <CardDescription className="text-xs text-content-secondary font-normal">
                Raw guest submission logs before AI normalization & duplicate matching.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-content-secondary absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter nominations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-raised text-content text-xs rounded-xl pl-9 pr-4 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
              />
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            {filteredNomList.length === 0 ? (
              <div className="py-12 text-center text-content-secondary text-xs space-y-2 font-normal">
                <Inbox className="w-8 h-8 text-content-secondary mx-auto" />
                <p>No nomination records submitted yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {filteredNomList.map((nom) => (
                  <div key={nom.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-raised transition-colors rounded-xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-content">{nom.nomineeText}</h4>
                        <Badge variant="default" size="sm">{nom.categoryName}</Badge>
                      </div>
                      <p className="text-xs text-content-secondary font-normal">Program: <strong className="text-content">{nom.eventTitle}</strong></p>
                      <span className="text-xs font-mono text-content-secondary block">Session ID: {nom.sessionId}</span>
                    </div>

                    <div className="text-xs text-content-secondary font-mono font-medium">
                      <span>{nom.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Suggested Categories Inbox */}
      {activeTab === "suggested" && (
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <CardTitle className="text-base font-bold text-content">Suggested categories inbox</CardTitle>
            <CardDescription className="text-xs text-content-secondary font-normal">
              Review new category ideas submitted by event voters. Approving a suggestion automatically creates an official category.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-4">
            {suggestedCategories.length === 0 ? (
              <div className="py-12 text-center text-content-secondary text-xs space-y-2 font-normal">
                <Inbox className="w-8 h-8 text-content-secondary mx-auto" />
                <p>No pending category suggestions found.</p>
              </div>
            ) : (
              suggestedCategories.map((sug) => {
                const isWorking = actioningId === sug.suggestionText;

                return (
                  <div
                    key={sug.id}
                    className="p-4 rounded-xl bg-surface-raised border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-content">{sug.suggestionText}</h4>
                        <Badge variant="warning" size="sm">Pending review</Badge>
                      </div>
                      <p className="text-xs text-content-secondary font-normal">Submitted for: <strong className="text-content">{sug.eventTitle}</strong></p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isWorking}
                        onClick={() => handleApprove(sug.eventId, sug.suggestionText)}
                        className="rounded-xl font-semibold text-xs"
                      >
                        {isWorking ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                        <span>Approve category</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isWorking}
                        onClick={() => handleReject(sug.eventId, sug.suggestionText)}
                        className="rounded-xl font-semibold text-xs"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        <span>Reject</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

