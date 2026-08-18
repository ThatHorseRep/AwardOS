"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trophy, Share2, ArrowLeft, Loader2, EyeOff, Star } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getPublicEventResultsAction } from "@/actions/results";
import { LiveResultsListener } from "@/components/voting/live-results-listener";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";

type PublicResults = NonNullable<Awaited<ReturnType<typeof getPublicEventResultsAction>>>;
type DisclosedPublicResults = Extract<PublicResults, { specialAwards: unknown }>;
type PublicSpecialAward = DisclosedPublicResults["specialAwards"][number];
type PublicCategoryResult = PublicResults["categoriesResults"][number];
type PublicWinner = PublicCategoryResult["winners"][number];

export default function PublicResultsPage() {
  const toast = useToast();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<PublicResults | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const data = await getPublicEventResultsAction(slug);
      setResults(data);
    } catch (err) {
      console.error("Failed to load public results view:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Results link copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }

  if (loadError) return <LoadError message="We could not load these results." onRetry={() => void loadData()} />;

  if (!results) {
    return (
      <div className="text-center py-12 font-sans select-none max-w-md mx-auto">
        <Card className="border-border-subtle bg-surface rounded-2xl p-8 text-center shadow-sm text-content">
          <h2 className="text-xl font-bold text-content">Event not found</h2>
          <Link href="/" className="mt-4 inline-block text-accent hover:underline font-semibold text-xs">
            Go to home page →
          </Link>
        </Card>
      </div>
    );
  }

  const isHidden = results.liveResultsMode === "HIDDEN";
  const showVotes = results.liveResultsMode === "FULL_LEADERBOARD" || results.liveResultsMode === "VOTE_COUNTS";
  const showPercentages = results.liveResultsMode === "FULL_LEADERBOARD" || results.liveResultsMode === "PERCENTAGES";
  const hasSpecialAwards = "specialAwards" in results && results.specialAwards.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans select-none pb-20">
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm" className="text-content-secondary hover:text-content">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back to event</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {!isHidden && "id" in results && <LiveResultsListener eventId={results.id} onVoteReceived={loadData} />}
          {!isHidden && (
            <Button variant="outline" size="sm" onClick={handleShare} className="rounded-xl text-xs font-semibold">
              <Share2 className="w-4 h-4 mr-1.5" />
              <span>Share results</span>
            </Button>
          )}
        </div>
      </div>

      {/* Winners Hero Banner */}
      <section 
        aria-label="Official results overview"
        className="relative rounded-2xl overflow-hidden p-6 sm:p-8 border border-border-subtle bg-surface text-center sm:text-left shadow-sm hover-lift text-content"
      >
        <div className="relative z-10 space-y-2">
          <Badge variant="default" size="md">
            Official results dashboard
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
            {results.name} results
          </h1>
          <p className="text-content-secondary text-xs sm:text-sm max-w-xl leading-relaxed font-normal">
            Congratulations to all winners, finalists, and participants. Live vote counts and percentages are verified in real time.
          </p>
        </div>
      </section>

      {/* Special Recognition & Discretionary Awards */}
      {!isHidden && hasSpecialAwards && "specialAwards" in results && (
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-accent" />
              <CardTitle className="text-base font-bold text-content">Special recognition awards</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.specialAwards.map((sa: PublicSpecialAward) => (
              <div key={sa.id} className="p-4 rounded-xl bg-surface-raised border border-border-subtle space-y-2 shadow-sm">
                <Badge variant="default" size="sm">{sa.name}</Badge>
                <h3 className="text-base font-bold text-content">{sa.recipientName}</h3>
                {sa.description && <p className="text-xs text-content-secondary leading-relaxed font-normal">{sa.description}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isHidden ? (
        <Card className="border-border-subtle bg-surface rounded-2xl p-12 text-center text-content-secondary space-y-3 shadow-sm font-medium">
          <EyeOff className="w-8 h-8 text-accent mx-auto" />
          <h3 className="text-base font-bold text-content">Results are currently locked</h3>
          <p className="text-xs text-content-secondary leading-relaxed max-w-md mx-auto">
            The event organizers have hidden live results during the tabulation audit phase. They will be shared here when officially published.
          </p>
        </Card>
      ) : results.categoriesResults.length === 0 ? (
        <Card className="border-border-subtle bg-surface rounded-2xl p-12 text-center text-content-secondary text-xs shadow-sm font-normal">
          No categories or votes results data available for this event yet.
        </Card>
      ) : (
        /* Results Category Showcase */
        <div className="space-y-6">
          {results.categoriesResults.map((cat: PublicCategoryResult) => {
            const winner = cat.winners.find((w: PublicWinner) => w.rank === 1 && w.status !== "DISQUALIFIED");
            const runnersUp = cat.winners.filter((w: PublicWinner) => w.rank > 1 && w.status !== "DISQUALIFIED");

            return (
              <Card key={cat.id} className="border-border-subtle overflow-hidden bg-surface rounded-2xl shadow-sm text-content">
                <CardHeader className="bg-surface-raised pb-3.5 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-accent" />
                    <CardTitle className="text-base font-bold text-content">{cat.categoryName}</CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  {/* Winner Highlight Box */}
                  {winner ? (
                    <div className="p-4 rounded-xl bg-surface-raised border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-page-entrance">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={winner.name}
                          size="lg"
                          className="border-2 border-accent shadow-sm shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-content">{winner.name}</h3>
                            <Badge variant="success" size="sm">Winner</Badge>
                          </div>
                          {winner.bio && <p className="text-xs text-content-secondary mt-1 max-w-lg leading-relaxed font-normal">{winner.bio}</p>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {showPercentages && (
                          <span className="text-xl font-bold text-accent block tabular-nums">{winner.percent}</span>
                        )}
                        {showVotes && (
                          <span className="text-xs text-content-secondary font-medium tabular-nums">{winner.votes} votes</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-content-secondary text-xs italic py-2 font-normal">No active winner found for this category.</div>
                  )}

                  {/* Runners Up list */}
                  {runnersUp.length > 0 && (
                    <div className="space-y-2.5 pt-2 border-t border-border-subtle">
                      <div className="text-xs text-content-secondary font-semibold uppercase block">Finalists & runners up</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {runnersUp.map((w: PublicWinner) => (
                          <div
                            key={w.id}
                            className="p-3 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-lg bg-surface border border-border-subtle text-xs text-content flex items-center justify-center font-bold tabular-nums">
                                0{w.rank}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-content block truncate">{w.name}</span>
                                <span className="text-xs text-content-secondary font-normal">{w.badgeStatus === "RUNNER_UP" ? "Runner up" : "Finalist"}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {showPercentages && (
                                <span className="text-xs font-bold text-accent block tabular-nums">{w.percent}</span>
                              )}
                              {showVotes && (
                                <span className="text-xs text-content-secondary font-normal tabular-nums">{w.votes} votes</span>
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
