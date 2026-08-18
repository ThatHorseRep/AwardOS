"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trophy, Vote, Sparkles, ShieldCheck, ArrowRight, Clock, CheckCircle2, Users, Loader2, Share2, Info, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getPublicEventDetailsAction } from "@/actions/events";
import { ShareKitModal } from "@/components/sharing/share-kit-modal";
import { LoadError } from "@/components/shared/load-error";
import { evaluateWorkflowWindow } from "@/lib/workflow/policy";

type PublicEvent = Awaited<ReturnType<typeof getPublicEventDetailsAction>>;
type PublicNominee = NonNullable<PublicEvent>["categories"][number]["nominees"][number];
type SelectedNominee = { nominee: PublicNominee; categoryName: string };

export default function PublicEventPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<PublicEvent>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedNomineeModal, setSelectedNomineeModal] = useState<SelectedNominee | null>(null);
  const [shareModalState, setShareModalState] = useState<{
    isOpen: boolean;
    nomineeName?: string;
    categoryName?: string;
    nomineeId?: string;
  }>({ isOpen: false });

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try { setEvent(await getPublicEventDetailsAction(slug)); }
    catch (err) { console.error("Failed to load public event view:", err); setLoadError(true); }
    finally { setLoading(false); }
  }, [slug]);
  useEffect(() => { void loadData(); }, [loadData]);

  const handleShareNominee = (nomineeName: string, catName: string, nomineeId?: string) => {
    setShareModalState({
      isOpen: true,
      nomineeName,
      categoryName: catName,
      nomineeId,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }

  if (loadError) return <LoadError message="We could not load this event." onRetry={() => void loadData()} />;

  if (!event) {
    return (
      <div className="text-center py-12 font-sans select-none max-w-md mx-auto">
        <Card className="border-border-subtle bg-surface rounded-2xl p-8 text-center shadow-sm">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3 border border-destructive/20">
              <Info className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-content">Event not found</CardTitle>
            <CardDescription className="text-xs text-content-secondary font-medium mt-1">
              The requested award event could not be found or has been removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link href="/" className="inline-block text-accent hover:underline font-semibold text-xs">
              Go to home page →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Find active or pending stages
  const activeStage = event.stages?.find((s) => s.status === "ACTIVE") || event.stages?.find((s) => s.status === "PENDING") || event.stages?.[0];
  const stageName = activeStage?.displayName || "Event live";

  const now = new Date();
  const isNominationActive = evaluateWorkflowWindow({ eventStatus: event.status, stage: event.stages?.find((stage) => stage.stageType === "NOMINATIONS"), now }).allowed;
  const isVotingActive = evaluateWorkflowWindow({ eventStatus: event.status, stage: event.stages?.find((stage) => stage.stageType === "VOTING"), now }).allowed;
  const isResultsPublished = event.liveResultsMode !== "HIDDEN";

  const deadlineStr = activeStage?.endsAt
    ? new Date(activeStage.endsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  return (
    <div className="space-y-6 font-sans select-none pb-16 max-w-5xl mx-auto">
      {/* Public Event Hero Banner */}
      <section 
        aria-label="Event details"
        className="relative rounded-2xl overflow-hidden p-6 sm:p-8 border border-border-subtle bg-surface text-center sm:text-left shadow-sm hover-lift"
      >
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <Badge variant="success" size="sm">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Live
            </Badge>
            <Badge variant="default" size="sm">
              <Sparkles className="w-3 h-3 mr-1 text-accent" /> {stageName}
            </Badge>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-content">
            {event.name}
          </h1>

          {event.description && (
            <p className="text-content-secondary text-xs sm:text-sm max-w-2xl leading-relaxed font-normal">
              {event.description}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-content-secondary font-medium">
            {activeStage?.endsAt && (
              <span className="flex items-center gap-1.5 font-semibold text-content">
                <Clock className="w-4 h-4 text-accent" /> Deadline: {deadlineStr}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-semibold text-content">
              <ShieldCheck className="w-4 h-4 text-success" />
              <span>{event.verificationLevel === "ADVANCED" ? "Advanced voter verification" : "Standard ballot integrity"}</span>
            </span>
          </div>

          {/* Call to Action Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3">
            {isVotingActive ? <Link href={`/e/${event.slug}/vote`}>
              <Button
                variant="primary"
                size="lg"
                className="px-6 py-2.5 rounded-xl text-xs font-semibold shadow-sm"
              >
                <Vote className="w-4 h-4 mr-1.5" />
                <span>{isVotingActive ? "Cast your ballot" : "Voting closed"}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link> : <Button variant="primary" size="lg" disabled className="px-6 py-2.5 text-xs font-semibold shadow-sm"><Vote className="mr-1.5 size-4" />Voting closed</Button>}

            {isNominationActive ? <Link href={`/e/${event.slug}/nominate`}>
              <Button variant="secondary" size="lg" className="px-5 py-2.5 rounded-xl text-xs font-semibold">
                <Users className="w-4 h-4 mr-1.5" />
                <span>Submit nomination</span>
              </Button>
            </Link> : <Button variant="secondary" size="lg" disabled className="px-5 py-2.5 text-xs font-semibold"><Users className="mr-1.5 size-4" />Nominations closed</Button>}

            {isResultsPublished && (
              <Link href={`/e/${event.slug}/results`}>
                <Button variant="outline" size="lg" className="px-5 py-2.5 rounded-xl text-xs font-semibold">
                  <Trophy className="w-4 h-4 text-accent mr-1.5" />
                  <span>View results</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Categories & Nominees Showcase */}
      <section aria-label="Award categories" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-content tracking-tight flex items-center gap-2">
            <span>Award categories & candidate roster</span>
            <Badge variant="neutral" size="sm">{event.categories?.length || 0}</Badge>
          </h2>
        </div>

        {event.categories?.length === 0 ? (
          <div className="text-center py-8 text-content-secondary text-xs font-medium">
            No active categories found for this program.
          </div>
        ) : (
          <div className="space-y-6">
            {event.categories?.map((cat, idx: number) => (
              <Card key={cat.id} className="border-border-subtle bg-surface rounded-2xl shadow-sm">
                <CardHeader className="pb-3 border-b border-border-subtle flex flex-row items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-surface-raised border border-border-subtle text-accent font-bold text-xs flex items-center justify-center">
                        0{idx + 1}
                      </span>
                      <CardTitle className="text-base font-bold text-content">{cat.name}</CardTitle>
                    </div>
                    {cat.description && <CardDescription className="text-xs mt-1 text-content-secondary font-normal">{cat.description}</CardDescription>}
                  </div>

                  {isVotingActive && (
                    <Link href={`/e/${event.slug}/vote`}>
                      <Button variant="ghost" size="sm" className="text-accent text-xs font-semibold hover:bg-surface-raised">
                        <span>Vote in division →</span>
                      </Button>
                    </Link>
                  )}
                </CardHeader>

                <CardContent className="pt-4">
                  {!cat.nominees || cat.nominees.length === 0 ? (
                    <div className="text-content-secondary text-xs py-4 font-normal">Candidate roster pending announcement.</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {cat.nominees.map((nom) => (
                        <div
                          key={nom.id}
                          className="p-4 rounded-xl bg-surface-raised border border-border-subtle hover:border-accent/40 shadow-sm transition-all duration-200 flex flex-col justify-between space-y-3 group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={nom.name} size="md" />
                              <div>
                                <h3 className="font-bold text-content text-sm group-hover:text-accent transition-colors">
                                  {nom.name}
                                </h3>
                                <span className="text-xs text-content-secondary block font-medium">Candidate</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleShareNominee(nom.name, cat.name, nom.id)}
                              className="text-content-secondary hover:text-content p-1.5 rounded-lg hover:bg-surface transition-colors"
                              title="Share candidate"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {nom.bio && (
                            <p className="text-xs text-content-secondary leading-relaxed line-clamp-2 font-normal">
                              {nom.bio}
                            </p>
                          )}

                          <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
                            <button
                              onClick={() => setSelectedNomineeModal({ nominee: nom, categoryName: cat.name })}
                              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                            >
                              <Info className="w-3 h-3" /> View bio
                            </button>

                            {isVotingActive && (
                              <Link href={`/e/${event.slug}/vote`}>
                                <Button variant="ghost" size="sm" className="h-6 text-xs text-accent font-semibold px-2">
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
      </section>

      {/* Nominee Full Bio Modal */}
      {selectedNomineeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-page-entrance font-sans">
          <div className="w-full max-w-md bg-surface border border-border-subtle rounded-2xl p-6 space-y-5 shadow-2xl relative text-content">
            <button
              onClick={() => setSelectedNomineeModal(null)}
              aria-label="Close modal"
              className="absolute right-4 top-4 p-1 text-content-secondary hover:text-content rounded-lg hover:bg-surface-raised font-bold"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <Avatar name={selectedNomineeModal.nominee.name} size="lg" />
              <div>
                <h3 className="font-bold text-content text-base">
                  {selectedNomineeModal.nominee.name}
                </h3>
                <Badge variant="default" size="sm" className="mt-1">
                  Category: {selectedNomineeModal.categoryName}
                </Badge>
              </div>
            </div>

            {selectedNomineeModal.nominee.bio ? (
              <p className="text-xs text-content-secondary leading-relaxed font-normal">
                {selectedNomineeModal.nominee.bio}
              </p>
            ) : (
              <p className="text-xs text-content-secondary italic">No biography provided for this nominee.</p>
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
                className="flex-1 rounded-xl text-xs font-semibold"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                <span>Share candidate</span>
              </Button>

              {isVotingActive && (
                <Link href={`/e/${event.slug}/vote`} className="flex-1">
                  <Button variant="primary" size="sm" className="w-full rounded-xl text-xs font-semibold">
                    <Vote className="w-3.5 h-3.5 mr-1.5" />
                    <span>Vote now</span>
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
