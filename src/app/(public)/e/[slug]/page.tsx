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
import { ShareKitModal } from "@/components/sharing/share-kit-modal";

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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 font-sans select-none">
        <h2 className="text-xl font-bold text-slate-900">Event not found</h2>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline font-bold">
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

  const [shareModalState, setShareModalState] = useState<{
    isOpen: boolean;
    nomineeName?: string;
    categoryName?: string;
    nomineeId?: string;
  }>({ isOpen: false });

  const handleShareNominee = (nomineeName: string, catName: string, nomineeId?: string) => {
    setShareModalState({
      isOpen: true,
      nomineeName,
      categoryName: catName,
      nomineeId,
    });
  };

  return (
    <div className="space-y-6 font-sans select-none pb-16 max-w-5xl mx-auto">
      {/* Public Event Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden p-8 border border-blue-200 bg-gradient-to-r from-blue-600/10 via-purple-50/50 to-white text-center sm:text-left shadow-sm">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Badge variant="success" size="sm">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Live
            </Badge>
            <Badge variant="purple" size="sm">
              <Sparkles className="w-3 h-3 mr-1" /> {stageName}
            </Badge>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            {event.name}
          </h1>

          {event.description && (
            <p className="text-slate-600 text-xs sm:text-sm max-w-2xl leading-relaxed font-medium">
              {event.description}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-600 font-medium">
            {activeStage?.endsAt && (
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="w-4 h-4 text-blue-600" /> Deadline: {deadlineStr}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
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
                className="rounded-full px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
              >
                <Vote className="w-5 h-5 mr-1.5" />
                <span>{isVotingActive ? "Cast Your Vote" : "Voting Closed"}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>

            <Link href={`/e/${event.slug}/nominate`}>
              <Button variant="secondary" size="lg" disabled={!isNominationActive} className="rounded-full px-6 py-3 bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 font-bold shadow-sm">
                <Users className="w-5 h-5 mr-1.5 text-purple-600" />
                <span>{isNominationActive ? "Submit Nomination" : "Nominations Closed"}</span>
              </Button>
            </Link>

            {isResultsPublished && (
              <Link href={`/e/${event.slug}/results`}>
                <Button variant="outline" size="lg" className="rounded-full px-6 py-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 font-bold shadow-sm">
                  <Trophy className="w-5 h-5 text-amber-500 mr-2" />
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Award Categories & Nominee Showcase</span>
            <Badge variant="neutral" size="sm">{event.categories?.length || 0}</Badge>
          </h2>
        </div>

        {event.categories?.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs italic font-medium">
            No active categories found for this program.
          </div>
        ) : (
          <div className="space-y-6">
            {event.categories?.map((cat: any, idx: number) => (
              <Card key={cat.id} className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        0{idx + 1}
                      </span>
                      <CardTitle className="text-base font-bold text-slate-900">{cat.name}</CardTitle>
                    </div>
                    {cat.description && <CardDescription className="text-xs mt-1 text-slate-600 font-medium">{cat.description}</CardDescription>}
                  </div>

                  {isVotingActive && (
                    <Link href={`/e/${event.slug}/vote`}>
                      <Button variant="ghost" size="sm" className="text-blue-600 text-xs font-bold hover:bg-blue-50">
                        <span>Vote in Division →</span>
                      </Button>
                    </Link>
                  )}
                </CardHeader>

                <CardContent className="pt-4">
                  {!cat.nominees || cat.nominees.length === 0 ? (
                    <div className="text-slate-500 text-xs italic py-4 font-medium">Nominee roster pending announcement.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {cat.nominees.map((nom: any) => (
                        <div
                          key={nom.id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 hover:border-blue-300 transition-all flex flex-col justify-between space-y-3 group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={nom.name} size="md" />
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                                  {nom.name}
                                </h4>
                                <span className="text-[10px] text-slate-500 block font-mono font-medium">Candidate Profile</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleShareNominee(nom.name, cat.name, nom.id)}
                              className="text-slate-400 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                              title="Share Candidate"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {nom.bio && (
                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 font-medium">
                              {nom.bio}
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                            <button
                              onClick={() => setSelectedNomineeModal({ nominee: nom, categoryName: cat.name })}
                              className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Info className="w-3 h-3" /> View Bio
                            </button>

                            {isVotingActive && (
                              <Link href={`/e/${event.slug}/vote`}>
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-600 font-bold px-2">
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 font-sans">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedNomineeModal(null)}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 font-bold"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <Avatar name={selectedNomineeModal.nominee.name} size="lg" />
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {selectedNomineeModal.nominee.name}
                </h3>
                <Badge variant="purple" size="sm" className="mt-1">
                  Category: {selectedNomineeModal.categoryName}
                </Badge>
              </div>
            </div>

            {selectedNomineeModal.nominee.bio ? (
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {selectedNomineeModal.nominee.bio}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">No biography provided for this nominee.</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentNom = selectedNomineeModal.nominee;
                  const currentCat = selectedNomineeModal.categoryName;
                  setSelectedNomineeModal(null);
                  handleShareNominee(currentNom.name, currentCat, currentNom.id);
                }}
                className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-full"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Share Profile & Embed</span>
              </Button>

              {isVotingActive && (
                <Link href={`/e/${event.slug}/vote`} className="flex-1">
                  <Button variant="primary" size="sm" className="w-full rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
                    <Vote className="w-3.5 h-3.5 mr-1.5" />
                    <span>Vote Now</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share & Embed Kit Modal */}
      <ShareKitModal
        isOpen={shareModalState.isOpen}
        onClose={() => setShareModalState({ isOpen: false })}
        eventName={event.name}
        eventSlug={event.slug}
        nomineeName={shareModalState.nomineeName}
        categoryName={shareModalState.categoryName}
        nomineeId={shareModalState.nomineeId}
      />
    </div>
  );
}
