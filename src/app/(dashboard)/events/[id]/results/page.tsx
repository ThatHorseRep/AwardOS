"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award, ArrowLeft, Globe, ExternalLink, Loader2, Trophy, Ban, Undo2, Plus, Trash2, Save } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";
import { getEventResultsAction, publishResultsAction, disqualifyNomineeAction, createSpecialAwardAction, getSpecialAwardsAction, deleteSpecialAwardAction, updateOfficialResultOverrideAction } from "@/actions/results";

type EventResults = Awaited<ReturnType<typeof getEventResultsAction>>;
type SpecialAward = Awaited<ReturnType<typeof getSpecialAwardsAction>>[number];

export default function OrganizerResultsPage() {
  const toast = useToast();
  const params = useParams();
  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [resultsData, setResultsData] = useState<EventResults | null>(null);
  const [specialAwardsList, setSpecialAwardsList] = useState<SpecialAward[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [disqualifyingId, setDisqualifyingId] = useState<string | null>(null);

  // Special Award Form State
  const [awardName, setAwardName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [awardDescription, setAwardDescription] = useState("");
  const [submittingAward, setSubmittingAward] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [data, awards] = await Promise.all([
        getEventResultsAction(eventId),
        getSpecialAwardsAction(eventId),
      ]);
      setResultsData(data);
      setSpecialAwardsList(awards);
    } catch (err) {
      console.error("Failed to load results payload:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loadError) return <LoadError onRetry={() => void loadData()} />;

  const handlePublishToggle = async () => {
    if (!resultsData) return;
    setPublishing(true);
    try {
      const currentMode = resultsData.liveResultsMode;
      const isCurrentlyPublished = currentMode !== "HIDDEN";
      await publishResultsAction(eventId, !isCurrentlyPublished);
      await loadData();
    } catch (err) {
      console.error("Failed to publish results:", err);
      toast.error("Error updating publish status.");
    } finally {
      setPublishing(false);
    }
  };

  const handleDisqualifyToggle = async (nomineeId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "DISQUALIFIED" ? "ACTIVE" : "DISQUALIFIED";
    const promptMsg =
      nextStatus === "DISQUALIFIED"
        ? "Are you sure you want to disqualify this nominee candidate? Their votes count will be kept in database but they will not be marked as a winner."
        : "Are you sure you want to restore this nominee candidate status back to active?";

    if (!confirm(promptMsg)) return;

    setDisqualifyingId(nomineeId);
    try {
      await disqualifyNomineeAction(nomineeId, nextStatus);
      await loadData();
    } catch (err) {
      console.error("Failed to toggle nominee status:", err);
      toast.error("Error toggling candidate disqualification.");
    } finally {
      setDisqualifyingId(null);
    }
  };

  const handleCreateSpecialAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardName.trim() || !recipientName.trim()) return;
    setSubmittingAward(true);
    try {
      await createSpecialAwardAction(eventId, awardName, recipientName, awardDescription);
      setAwardName("");
      setRecipientName("");
      setAwardDescription("");
      await loadData();
    } catch (err) {
      console.error("Failed to create special award:", err);
      toast.error("Error creating special award.");
    } finally {
      setSubmittingAward(false);
    }
  };

  const handleDeleteSpecialAward = async (awardId: string) => {
    if (!confirm("Are you sure you want to delete this special award?")) return;
    try {
      await deleteSpecialAwardAction(awardId);
      await loadData();
    } catch (err) {
      console.error("Failed to delete award:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!resultsData) {
    return (
      <div className="text-center py-12 text-slate-300 font-sans">
        <h2 className="text-xl font-bold text-white">Results not available</h2>
        <Link href={`/events/${eventId}`} className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Event Overview
        </Link>
      </div>
    );
  }

  const isPublished = resultsData.liveResultsMode !== "HIDDEN";

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" aria-label="Back to event" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-400" />
              <span>Official Results & Tally Board</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Audit dynamic vote counts, disqualify candidates, define special awards, and publish the leaderboard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/e/${resultsData.slug}/results`} target="_blank">
            <Button variant="outline" size="sm" className="border-slate-800 text-slate-200">
              <ExternalLink className="w-4 h-4 mr-2" />
              <span>Public Results Link</span>
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            disabled={publishing}
            onClick={handlePublishToggle}
            className={
              isPublished
                ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-400/30 text-white"
                : "bg-amber-600 hover:bg-amber-500 border-amber-400/30 text-white"
            }
          >
            {publishing ? (
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
            ) : (
              <Globe className="w-4 h-4 mr-2" />
            )}
            <span>{isPublished ? "Published (Live)" : "Publish Results"}</span>
          </Button>
        </div>
      </div>

      {/* Special Awards Manager Section */}
      <Card className="border-amber-500/25 bg-amber-950/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <CardTitle className="text-sm font-bold text-white">Special Recognition &amp; Judges&apos; Awards</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Add discretionary non-voting awards (e.g. Organizer&apos;s Choice, Outstanding Contribution).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateSpecialAward} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              aria-label="Special award title"
              type="text"
              required
              placeholder="Award Title (e.g. Organizer's Choice)"
              value={awardName}
              onChange={(e) => setAwardName(e.target.value)}
              className="rounded-xl bg-slate-900 text-xs text-slate-200"
            />
            <Input
              aria-label="Special award recipient"
              type="text"
              required
              placeholder="Recipient Name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="rounded-xl bg-slate-900 text-xs text-slate-200"
            />
            <div className="flex gap-2">
              <Input
                aria-label="Special award citation"
                type="text"
                placeholder="Description / Citation"
                value={awardDescription}
                onChange={(e) => setAwardDescription(e.target.value)}
                className="w-full rounded-xl bg-slate-900 text-xs text-slate-200"
              />
              <Button type="submit" variant="primary" aria-label="Add special award" disabled={submittingAward} className="bg-amber-600 hover:bg-amber-500 text-white shrink-0 text-xs">
                {submittingAward ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </form>

          {specialAwardsList.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800/60">
              {specialAwardsList.map((sa) => (
                <div key={sa.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="gold" size="sm">{sa.name}</Badge>
                      <span className="font-bold text-white">{sa.recipientName}</span>
                    </div>
                    {sa.description && <p className="text-[11px] text-slate-400 mt-1">{sa.description}</p>}
                  </div>
                  <Button variant="ghost" size="sm" aria-label={`Delete ${sa.name}`} onClick={() => handleDeleteSpecialAward(sa.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results details */}
      <div className="space-y-6">
        {resultsData.categoriesResults.length === 0 ? (
          <Card className="border-slate-800 bg-slate-950/10 p-12 text-center text-slate-500 text-xs">
            No categories or voting tallies found. Make sure categories and nominees exist, and votes are submitted.
          </Card>
        ) : (
          resultsData.categoriesResults.map((cat) => (
            <Card key={cat.id} className="border-slate-800 bg-slate-950/20">
              <CardHeader className="pb-3 border-b border-slate-900/60">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-white">{cat.categoryName}</CardTitle>
                    <CardDescription className="text-[11px] mt-0.5">
                      Total Valid Votes: <strong className="text-slate-200">{cat.totalVotes}</strong> (excluding invalid audit sessions)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-5">
                {cat.winners.length === 0 ? (
                  <div className="text-slate-500 text-xs italic py-4">No nominee records configured.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/80 text-slate-500 font-medium">
                          <th className="py-2.5 font-semibold">Rank</th>
                          <th className="py-2.5 font-semibold">Candidate</th>
                          <th className="py-2.5 font-semibold text-center">Official Votes</th>
                          <th className="py-2.5 font-semibold text-center">Vote %</th>
                          <th className="py-2.5 font-semibold text-center">Raw Submitted</th>
                          <th className="py-2.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.winners.map((win) => {
                          const isDisqualified = win.status === "DISQUALIFIED";
                          const isToggling = disqualifyingId === win.id;

                          return (
                            <tr
                              key={win.id}
                              className={`border-b border-slate-900/40 hover:bg-slate-900/10 ${
                                isDisqualified ? "opacity-50" : ""
                              }`}
                            >
                              <td className="py-3 font-semibold text-slate-300">
                                {isDisqualified ? (
                                  <span className="text-rose-400">DQ</span>
                                ) : (
                                  <Badge
                                    variant={
                                      win.rank === 1
                                        ? "gold"
                                        : win.rank === 2
                                        ? "purple"
                                        : "default"
                                    }
                                    className="text-[10px]"
                                  >
                                    0{win.rank}
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3">
                                <div className="font-bold text-white text-sm">{win.name}</div>
                                {win.bio && <div className="text-[10px] text-slate-400 mt-0.5">{win.bio}</div>}
                              </td>
                              <td className="py-3 text-center font-bold text-white">{win.votes}</td>
                              <td className="py-3 text-center font-bold text-amber-300">{win.percent}</td>
                              <td className="py-3 text-center font-mono text-slate-300">{win.rawVotes}</td>
                              <td className="py-3 text-right">
                                {win.officialResultId && (
                                  <OverrideEditor
                                    eventId={eventId}
                                    resultId={win.officialResultId}
                                    rank={win.overrideRank}
                                    reason={win.overrideReason}
                                    onSaved={loadData}
                                  />
                                )}
                                {isDisqualified ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isToggling}
                                    onClick={() => handleDisqualifyToggle(win.id, "DISQUALIFIED")}
                                    className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 text-[10px] px-2.5"
                                  >
                                    {isToggling ? (
                                      <Loader2 className="animate-spin w-3.5 h-3.5" />
                                    ) : (
                                      <Undo2 className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    <span>Restore Nominee</span>
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isToggling}
                                    onClick={() => handleDisqualifyToggle(win.id, "ACTIVE")}
                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 h-7 text-[10px] px-2.5"
                                  >
                                    {isToggling ? (
                                      <Loader2 className="animate-spin w-3.5 h-3.5" />
                                    ) : (
                                      <Ban className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    <span>Disqualify</span>
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function OverrideEditor({ eventId, resultId, rank, reason, onSaved }: { eventId: string; resultId: string; rank: number | null; reason: string | null; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [nextRank, setNextRank] = useState(rank?.toString() ?? "");
  const [nextReason, setNextReason] = useState(reason ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateOfficialResultOverrideAction({
        eventId,
        officialResultId: resultId,
        rank: nextRank.trim() ? Number(nextRank) : null,
        reason: nextReason,
      });
      toast.success(nextRank.trim() ? "Official rank override saved." : "Official rank override removed.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the rank override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-2 flex items-center justify-end gap-1.5">
      <input aria-label="Official rank override" type="number" min={1} max={999} value={nextRank} onChange={(event) => setNextRank(event.target.value)} placeholder="Rank" className="w-14 rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs text-content" />
      <input aria-label="Rank override reason" value={nextReason} onChange={(event) => setNextReason(event.target.value)} placeholder="Reason" className="w-28 rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs text-content" />
      <Button type="button" variant="ghost" size="icon" aria-label="Save rank override" disabled={saving} onClick={() => void save()}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
      </Button>
    </div>
  );
}
