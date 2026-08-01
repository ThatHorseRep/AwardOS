"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Trophy,
  Calendar,
  Vote,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
  Users,
  Award,
  Loader2,
  Share2,
  User,
  Info,
  X,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getPublicEventDetailsAction } from "@/actions/events";

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any | null>(null);
  const [selectedNomineeModal, setSelectedNomineeModal] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getPublicEventDetailsAction(slug);
        setEvent(data);
      } catch (err) {
        console.error("Failed to load public event view:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 text-slate-300 font-sans">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <Link href="/" className="mt-4 inline-block text-indigo-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  // Find active or pending stages
  const activeStage = event.stages?.find((s: any) => s.status === "ACTIVE") || event.stages?.find((s: any) => s.status === "PENDING") || event.stages?.[0];
  const activeStageType = activeStage?.stageType;
  const stageName = activeStage?.displayName || "Event Live";

  const isNominationActive = activeStageType === "NOMINATIONS" || activeStageType === "NOMINATION" || event.status === "ACTIVE";
  const isVotingActive = activeStageType === "VOTING" || event.status === "VOTING";
  const isResultsPublished = event.liveResultsMode !== "HIDDEN";

  const deadlineStr = activeStage?.endsAt
    ? new Date(activeStage.endsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const handleShareNominee = (nomineeName: string, catName: string) => {
    const text = `Check out ${nomineeName} nominated for ${catName} in ${event.name}!`;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: event.name, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      alert("Nominee link copied to clipboard!");
    }
  };

  return (
    <div className="space-y-8 font-sans pb-16 max-w-5xl mx-auto">
      {/* Public Event Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden glass-card p-8 border border-indigo-500/25 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/85 text-center sm:text-left">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Badge variant="success" size="sm">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Live
            </Badge>
            <Badge variant="purple" size="sm">
              <Sparkles className="w-3 h-3 mr-1" /> {stageName}
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            {event.name}
          </h1>

          {event.description && (
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {event.description}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
            {activeStage?.endsAt && (
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-indigo-400" /> Deadline: {deadlineStr}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{event.verificationLevel === "ADVANCED" ? "Advanced Access Check" : "Standard Ballot Integrity"}</span>
            </span>
          </div>

          {/* Call to Action Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <Link href={`/e/${event.slug}/vote`}>
              <Button
                variant="primary"
                size="lg"
                disabled={!isVotingActive}
                className="rounded-full px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xl shadow-blue-600/30"
              >
                <Vote className="w-5 h-5 mr-1" />
                <span>{isVotingActive ? "Cast Your Vote" : "Voting Closed"}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>

            <Link href={`/e/${event.slug}/nominate`}>
              <Button variant="secondary" size="lg" disabled={!isNominationActive} className="rounded-full px-6 py-3 bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800">
                <Users className="w-5 h-5 mr-1" />
                <span>{isNominationActive ? "Submit Nomination" : "Nominations Closed"}</span>
              </Button>
            </Link>

            {isResultsPublished && (
              <Link href={`/e/${event.slug}/results`}>
                <Button variant="outline" size="lg" className="rounded-full px-6 py-3 border-slate-800 text-slate-200 hover:bg-slate-900">
                  <Trophy className="w-5 h-5 text-amber-400 mr-2" />
                  <span>View Results</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Categories & Nominees Showcase */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Award Categories & Nominee Showcase</span>
            <Badge variant="neutral" size="sm">{event.categories?.length || 0}</Badge>
          </h2>
        </div>

        {event.categories?.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs italic">
            No active categories found for this program.
          </div>
        ) : (
          <div className="space-y-6">
            {event.categories?.map((cat: any, idx: number) => (
              <Card key={cat.id} className="border-slate-800 bg-slate-950/20">
                <CardHeader className="pb-3 border-b border-slate-900/60 flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs flex items-center justify-center border border-indigo-500/20">
                        0{idx + 1}
                      </span>
                      <CardTitle className="text-base text-slate-100">{cat.name}</CardTitle>
                    </div>
                    {cat.description && <CardDescription className="text-xs mt-1 text-slate-400">{cat.description}</CardDescription>}
                  </div>

                  {isVotingActive && (
                    <Link href={`/e/${event.slug}/vote`}>
                      <Button variant="ghost" size="sm" className="text-indigo-400 text-xs hover:bg-indigo-500/10">
                        <span>Vote in Division →</span>
                      </Button>
                    </Link>
                  )}
                </CardHeader>

                <CardContent className="pt-4">
                  {!cat.nominees || cat.nominees.length === 0 ? (
                    <div className="text-slate-500 text-xs italic py-4">Nominee roster pending announcement.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {cat.nominees.map((nom: any) => (
                        <div
                          key={nom.id}
                          className="p-4 rounded-2xl bg-slate-900/40 border border-slate-850 hover:border-slate-700/60 transition-all flex flex-col justify-between space-y-3 group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={nom.name} size="md" />
                              <div>
                                <h4 className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">
                                  {nom.name}
                                </h4>
                                <span className="text-[10px] text-slate-500 block font-mono">Candidate Profile</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleShareNominee(nom.name, cat.name)}
                              className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                              title="Share Candidate"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {nom.bio && (
                            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                              {nom.bio}
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-900/60 flex items-center justify-between">
                            <button
                              onClick={() => setSelectedNomineeModal({ nominee: nom, categoryName: cat.name })}
                              className="text-[11px] font-medium text-indigo-400 hover:underline flex items-center gap-1"
                            >
                              <Info className="w-3 h-3" /> View Bio
                            </button>

                            {isVotingActive && (
                              <Link href={`/e/${event.slug}/vote`}>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-400 px-2">
                                  Vote
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Nominee Full Bio Modal */}
      {selectedNomineeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 font-sans">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedNomineeModal(null)}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <Avatar name={selectedNomineeModal.nominee.name} size="lg" />
              <div>
                <Badge variant="purple" size="sm">{selectedNomineeModal.categoryName}</Badge>
                <h3 className="text-lg font-bold text-white mt-1">{selectedNomineeModal.nominee.name}</h3>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs font-semibold text-slate-300 block">Candidate Biography</span>
              <p className="text-xs text-slate-400 leading-relaxed max-h-60 overflow-y-auto pr-1">
                {selectedNomineeModal.nominee.bio || "No biography details published for this candidate profile."}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShareNominee(selectedNomineeModal.nominee.name, selectedNomineeModal.categoryName)}
                className="flex-1 border-slate-800 text-slate-200 hover:bg-slate-800"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Share Profile</span>
              </Button>

              {isVotingActive && (
                <Link href={`/e/${event.slug}/vote`} className="flex-1">
                  <Button variant="primary" size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                    <Vote className="w-3.5 h-3.5 mr-1.5" />
                    <span>Vote Now</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
