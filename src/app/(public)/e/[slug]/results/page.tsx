"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Trophy,
  Award,
  Medal,
  CheckCircle2,
  Share2,
  ArrowLeft,
  Sparkles,
  Home,
  Loader2,
  EyeOff,
  RefreshCw,
  Star,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getPublicEventResultsAction } from "@/actions/results";
import { LiveResultsListener } from "@/components/voting/live-results-listener";

export default function PublicResultsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await getPublicEventResultsAction(slug);
      setResults(data);
    } catch (err) {
      console.error("Failed to load public results view:", err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Results link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!results) {
    return (
      <div className="text-center py-12 text-slate-300 font-sans">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <Link href="/" className="mt-4 inline-block text-indigo-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  const isHidden = results.liveResultsMode === "HIDDEN";
  const showVotes = results.liveResultsMode === "FULL_LEADERBOARD" || results.liveResultsMode === "VOTE_COUNTS";
  const showPercentages = results.liveResultsMode === "FULL_LEADERBOARD" || results.liveResultsMode === "PERCENTAGES";
  const hasSpecialAwards = results.specialAwards && results.specialAwards.length > 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto font-sans pb-12">
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span>Back to Event</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {!isHidden && <LiveResultsListener eventId={results.id} onVoteReceived={loadData} />}
          {!isHidden && (
            <Button variant="outline" size="sm" onClick={handleShare} className="border-slate-800 text-slate-200">
              <Share2 className="w-4 h-4 mr-2" />
              <span>Share Results</span>
            </Button>
          )}
        </div>
      </div>

      {/* Winners Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-card p-8 border border-amber-500/25 bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900/80 text-center sm:text-left">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <Badge variant="gold" size="md">
            👑 Official Results Dashboard
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {results.name} Results
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
            Congratulations to all winners, finalists, and participants. Live vote counts and percentages are verified in real time.
          </p>
        </div>
      </div>

      {/* Special Recognition & Discretionary Awards */}
      {!isHidden && hasSpecialAwards && (
        <Card className="border-amber-500/30 bg-amber-950/15">
          <CardHeader className="pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <CardTitle className="text-base text-white">Special Recognition & Discretionary Awards</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.specialAwards.map((sa: any) => (
              <div key={sa.id} className="p-4 rounded-2xl bg-slate-900/60 border border-amber-500/20 space-y-2">
                <Badge variant="gold" size="sm">{sa.name}</Badge>
                <h3 className="text-base font-bold text-white">{sa.recipientName}</h3>
                {sa.description && <p className="text-xs text-slate-300 leading-relaxed">{sa.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isHidden ? (
        <Card className="border-slate-850 bg-slate-950/20 p-12 text-center text-slate-400 space-y-3">
          <EyeOff className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-white">Results are currently locked</h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            The event organizers have hidden live results during the tabulation audit phase. They will be shared here when officially published.
          </p>
        </Card>
      ) : results.categoriesResults.length === 0 ? (
        <Card className="border-slate-850 bg-slate-950/20 p-12 text-center text-slate-400">
          No categories or votes results data available for this event yet.
        </Card>
      ) : (
        /* Results Category Showcase */
        <div className="space-y-6">
          {results.categoriesResults.map((cat: any, idx: number) => {
            const winner = cat.winners.find((w: any) => w.rank === 1 && w.status !== "DISQUALIFIED");
            const runnersUp = cat.winners.filter((w: any) => w.rank > 1 && w.status !== "DISQUALIFIED");

            return (
              <Card key={cat.id} className="border-amber-500/25 overflow-hidden bg-slate-950/15">
                <CardHeader className="bg-slate-900/30 pb-4 border-b border-slate-900/60">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <CardTitle className="text-base text-slate-100">{cat.categoryName}</CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  {/* Winner Highlight Box */}
                  {winner ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-slate-900/40 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={winner.name}
                          size="lg"
                          className="border-2 border-amber-400/80 shadow-lg shadow-amber-500/10 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-white">{winner.name}</h3>
                            <Badge variant="gold" size="sm">👑 1st Place Winner</Badge>
                          </div>
                          {winner.bio && <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">{winner.bio}</p>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {showPercentages && (
                          <span className="text-xl font-bold text-amber-300 block">{winner.percent}</span>
                        )}
                        {showVotes && (
                          <span className="text-[10px] text-slate-400">{winner.votes} votes</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs italic py-2">No active winner found for this category.</div>
                  )}

                  {/* Runners Up list */}
                  {runnersUp.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-900/40">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase block">Finalists & Runners Up</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {runnersUp.map((w: any) => (
                          <div
                            key={w.id}
                            className="p-3 rounded-xl bg-slate-900/30 border border-slate-900/60 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-slate-800 text-[10px] text-slate-400 flex items-center justify-center font-bold font-mono">
                                0{w.rank}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-200 block truncate">{w.name}</span>
                                <span className="text-[10px] text-slate-500">{w.badgeStatus === "RUNNER_UP" ? "Runner Up" : "Finalist"}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono">
                              {showPercentages && (
                                <span className="text-xs font-bold text-indigo-400 block">{w.percent}</span>
                              )}
                              {showVotes && (
                                <span className="text-[9px] text-slate-500">{w.votes} votes</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
