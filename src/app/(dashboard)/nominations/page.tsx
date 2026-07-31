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
  Loader2,
  Inbox,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getWorkspaceNominationsAction,
  approveSuggestionAction,
  rejectSuggestionAction,
} from "@/actions/nominations";

export default function OrganizerNominationsPage() {
  const [loading, setLoading] = useState(true);
  const [rawNominations, setRawNominations] = useState<any[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"stream" | "suggested">("stream");
  const [searchQuery, setSearchQuery] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await getWorkspaceNominationsAction();
      setRawNominations(data.rawNominations);
      setSuggestedCategories(data.suggestedCategories);
    } catch (err) {
      console.error("Failed to load nominations inbox:", err);
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
      alert("Error approving category.");
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
      alert("Error rejecting suggestion.");
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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Nominations & Category Inbox</span>
            <Badge variant="purple" size="sm">
              {rawNominations.length} Submissions
            </Badge>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Review raw guest nominations and approve suggested category submissions from event visitors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="border-slate-800 text-slate-200">
            <Download className="w-4 h-4 mr-1.5" />
            <span>Export CSV</span>
          </Button>

          <Link href="/cleanup">
            <Button variant="primary" size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
              <Sparkles className="w-4 h-4 mr-1.5" />
              <span>Launch AI Cleanup Engine</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80">
        <button
          onClick={() => setActiveTab("stream")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
            activeTab === "stream"
              ? "text-indigo-400 border-indigo-500 bg-indigo-600/10"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Raw Nominations Stream ({rawNominations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("suggested")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
            activeTab === "suggested"
              ? "text-purple-400 border-purple-500 bg-purple-600/10"
              : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Suggested Categories Inbox ({suggestedCategories.length})</span>
        </button>
      </div>

      {/* Tab 1: Raw Nominations Stream */}
      {activeTab === "stream" && (
        <Card className="border-slate-800 bg-slate-950/20">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold text-white">Incoming Nominations Stream</CardTitle>
              <CardDescription className="text-xs">
                Raw guest submission logs before AI normalization & duplicate matching.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter nominations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </CardHeader>

          <CardContent>
            {filteredNomList.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No nomination records submitted yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {filteredNomList.map((nom) => (
                  <div key={nom.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{nom.nomineeText}</h4>
                        <Badge variant="purple" size="sm">{nom.categoryName}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">Program: <strong className="text-slate-300">{nom.eventTitle}</strong></p>
                      <span className="text-[10px] font-mono text-slate-500 block">Session ID: {nom.sessionId}</span>
                    </div>

                    <div className="text-xs text-slate-400 font-mono">
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
        <Card className="border-slate-800 bg-slate-950/20">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Suggested Categories Inbox</CardTitle>
            <CardDescription className="text-xs">
              Review new category ideas submitted by event voters. Approving a suggestion automatically creates an official category.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {suggestedCategories.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
                <p>No pending category suggestions found.</p>
              </div>
            ) : (
              suggestedCategories.map((sug) => {
                const isWorking = actioningId === sug.suggestionText;

                return (
                  <div
                    key={sug.id}
                    className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{sug.suggestionText}</h4>
                        <Badge variant="warning" size="sm">Pending Review</Badge>
                      </div>
                      <p className="text-xs text-slate-400">Submitted for: <strong className="text-slate-300">{sug.eventTitle}</strong></p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isWorking}
                        onClick={() => handleApprove(sug.eventId, sug.suggestionText)}
                        className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400/30 text-white"
                      >
                        {isWorking ? <Loader2 className="animate-spin w-3.5 h-3.5 mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                        <span>Approve Category</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isWorking}
                        onClick={() => handleReject(sug.eventId, sug.suggestionText)}
                        className="border-slate-800 text-slate-300 hover:bg-slate-800"
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
