"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Vote,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Check,
  Lock,
  Mail,
  KeyRound,
  RotateCcw,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  getPublicBallotDetailsAction,
  sendEmailOtpAction,
  verifyEmailOtpAction,
  verifyInvitationCodeAction,
} from "@/actions/voting";

export default function PublicBallotPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Selected candidates per category ID: { catId -> nomineeId }
  const [selectedVotes, setSelectedVotes] = useState<{ [catId: string]: string }>({});

  // Verification Step States
  const [verificationStep, setVerificationStep] = useState<"EMAIL" | "OTP" | "INVITATION_CODE" | "BALLOT">("BALLOT");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationSession, setVerificationSession] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getPublicBallotDetailsAction(slug);
        if (!data) return;
        setEvent(data);

        // "Already voted" is decided server-side from the HTTP-only ballot cookie.
        // localStorage is not consulted: it is readable and clearable by the voter.
        setHasVoted(Boolean(data.hasVoted));

        // Determine verification step based on configuration
        const method = data.verificationConfig?.method || "NONE";
        if (method === "EMAIL_OTP") {
          setVerificationStep("EMAIL");
        } else if (method === "INVITATION_CODE") {
          setVerificationStep("INVITATION_CODE");
        } else {
          setVerificationStep("BALLOT");
        }
      } catch (err) {
        console.error("Failed to load ballot details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const handleSelectNominee = (catId: string, nomineeId: string) => {
    setSelectedVotes((prev) => ({
      ...prev,
      [catId]: nomineeId,
    }));
  };

  const handleSkipCategory = (catId: string) => {
    setSelectedVotes((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
  };

  // OTP: Send code handler
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setVerifying(true);
    try {
      const result = await sendEmailOtpAction(event.id, email.trim());
      if (result.success) {
        setOtpId(result.otpId);
        setVerificationStep("OTP");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send verification code.");
    } finally {
      setVerifying(false);
    }
  };

  // OTP: Verify code handler
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || !otpId) return;
    setError(null);
    setVerifying(true);
    try {
      const result = await verifyEmailOtpAction(event.id, email.trim(), otpCode.trim());
      if (result.success) {
        setVerificationSession({
          method: "EMAIL_OTP",
          email: email.trim(),
          otpId: result.otpId,
        });
        setVerificationStep("BALLOT");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid or expired verification code.");
    } finally {
      setVerifying(false);
    }
  };

  // Invitation Code: Verify code handler
  const handleVerifyInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationCode.trim()) return;
    setError(null);
    setVerifying(true);
    try {
      const result = await verifyInvitationCodeAction(event.id, invitationCode.trim());
      if (result.success) {
        setVerificationSession({
          method: "INVITATION_CODE",
          code: invitationCode.trim().toUpperCase(),
        });
        setVerificationStep("BALLOT");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid or expired invitation code.");
    } finally {
      setVerifying(false);
    }
  };

  // Cast Ballot Handler
  const handleCastBallot = async () => {
    setError(null);
    setSubmitting(true);

    try {
      let sessionId = localStorage.getItem("awardos_session_id");
      if (!sessionId) {
        sessionId = `sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
        localStorage.setItem("awardos_session_id", sessionId);
      }

      const votesPayload = event.categories.map((cat: any) => ({
        categoryId: cat.id,
        nomineeId: selectedVotes[cat.id] || null,
        skipped: !selectedVotes[cat.id],
      }));

      const response = await fetch(`/api/public/events/${slug}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          votes: votesPayload,
          sessionId,
          verificationSession,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit ballot.");
      }

      // No localStorage marker: the votes route set an HTTP-only cookie as the
      // authoritative record, which survives incognito exits and storage clears.
      setHasVoted(true);
      router.push(`/e/${slug}/vote/thank-you`);
    } catch (err: any) {
      setError(err?.message || "An error occurred submitting your ballot.");
      // Keep modal open so the voter can see the error and retry
    } finally {
      setSubmitting(false);
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
      <Card className="border-slate-200/80 bg-white rounded-3xl p-8 text-center max-w-lg mx-auto shadow-sm font-sans select-none my-12">
        <CardHeader>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
            <Info className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">Event Not Found</CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium mt-1">
            The requested award event could not be found.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const votingStage = event?.stages?.find((s: any) => s.stageType === "VOTING");
  const isVotingActive = votingStage ? votingStage.status === "ACTIVE" : event?.status === "ACTIVE";

  if (!isVotingActive) {
    return (
      <Card className="border-slate-200/80 bg-white rounded-3xl p-8 text-center max-w-lg mx-auto shadow-sm font-sans select-none my-12">
        <CardHeader>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
            <Info className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">Voting Period Closed or Pending</CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium mt-1">
            Voting is not currently active for {event?.name || "this event"}. Please check the event schedule for updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Link href={`/e/${slug}`}>
            <Button variant="primary" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-6">
              Return to Event Program
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const totalSelected = Object.keys(selectedVotes).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-20">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm" className="text-slate-700 hover:bg-slate-200">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back to Event</span>
          </Button>
        </Link>

        <Badge variant="success" size="sm" className="gap-1.5 flex items-center">
          <Vote className="w-3 h-3" /> Voting Ballot Live
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Official Voter Ballot</h1>
        <p className="text-slate-600 text-xs max-w-lg mx-auto leading-relaxed font-medium">
          Select one candidate per category for <strong className="text-slate-900">{event.name}</strong>. Your vote is write-once and protected against duplicate submissions.
        </p>
      </div>

      {hasVoted && (
        <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-300 font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>You have already cast a ballot for this event. Ballots are write-once and immutable.</span>
          </div>
          <Link href={`/e/${slug}/vote/thank-you`}>
            <Button variant="outline" size="sm" className="bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-bold">
              View Confirmation
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-in fade-in duration-300">
          {error}
        </div>
      )}

      {/* STEP 1: Email Input View */}
      {verificationStep === "EMAIL" && !hasVoted && (
        <Card className="max-w-md mx-auto border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">Email Verification</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600 font-medium">
              Voter authentication is required. Enter your email to receive a 6-digit access code.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSendOtp} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voter@college.edu"
                className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-mono font-medium"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={verifying}
                className="w-full rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
              >
                {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                <span>Send Access Code</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: OTP Verification Code View */}
      {verificationStep === "OTP" && !hasVoted && (
        <Card className="max-w-md mx-auto border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-base font-bold text-slate-900">Enter Verification Code</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600 font-medium">
              We sent a 6-digit authentication OTP code to <strong className="text-slate-900">{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="e.g. 123456"
                className="w-full bg-slate-50 text-center text-slate-900 text-lg tracking-widest rounded-2xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-purple-500 font-mono font-extrabold"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={verifying || otpCode.length < 6}
                className="w-full rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/20"
              >
                {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                <span>Verify & Access Ballot</span>
              </Button>
              <button
                type="button"
                onClick={() => setVerificationStep("EMAIL")}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-900 flex items-center justify-center gap-1 mt-2 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Change Email Address</span>
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Invitation Code Authentication View */}
      {verificationStep === "INVITATION_CODE" && !hasVoted && (
        <Card className="max-w-md mx-auto border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900">Invitation Code Required</CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-600 font-medium">
              This event is private. Please enter your unique 8-character invitation credential.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleVerifyInvitation} className="space-y-4">
              <input
                type="text"
                required
                maxLength={8}
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                placeholder="Enter Code (e.g. A8B9C7D6)"
                className="w-full bg-slate-50 text-center text-slate-900 text-base tracking-widest rounded-2xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-mono font-extrabold uppercase"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={verifying || invitationCode.length < 8}
                className="w-full rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
              >
                {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                <span>Authenticate & Access Ballot</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Live Ballot Form view */}
      {verificationStep === "BALLOT" && !hasVoted && (
        <div className="space-y-6">
          <div className="space-y-6">
            {event.categories.map((cat: any, idx: number) => {
              const selectedNomineeId = selectedVotes[cat.id];

              return (
                <Card key={cat.id} className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between space-y-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="purple" size="sm">Category 0{idx + 1}</Badge>
                        {selectedNomineeId && (
                          <Badge variant="success" size="sm">
                            <Check className="w-3 h-3" /> Voted
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base text-slate-900 font-bold mt-1.5">{cat.name}</CardTitle>
                      {cat.description && <CardDescription className="text-xs text-slate-600 font-medium leading-relaxed mt-1">{cat.description}</CardDescription>}
                    </div>

                    {selectedNomineeId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSkipCategory(cat.id)}
                        className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                      >
                        Clear Selection
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3 pt-4">
                    {cat.nominees.length === 0 ? (
                      <div className="text-slate-500 text-xs italic py-4 font-medium">No nominee candidates configured in this category.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {cat.nominees.map((nom: any) => {
                          const isSelected = selectedNomineeId === nom.id;

                          return (
                            <div
                              key={nom.id}
                              onClick={() => handleSelectNominee(cat.id, nom.id)}
                              className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${
                                isSelected
                                  ? "bg-blue-50 border-blue-500 text-slate-900 shadow-md shadow-blue-500/10"
                                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-900"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={nom.name} size="sm" />
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-900 leading-tight">{nom.name}</h4>
                                  </div>
                                </div>

                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-blue-600 border-blue-600 text-white"
                                      : "border-slate-300 bg-slate-100"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>

                              {nom.bio && (
                                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3 font-medium">
                                  {nom.bio}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Floating Bottom Action Bar */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl p-4 rounded-full bg-slate-900/95 text-white border border-slate-800 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 z-40 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                {totalSelected}/{event.categories.length}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {totalSelected === 0
                    ? "No selections made yet"
                    : `${totalSelected} of ${event.categories.length} Categories Voted`}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {totalSelected < event.categories.length ? "You can skip unselected categories" : "All categories selected!"}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={totalSelected === 0 || hasVoted}
              onClick={() => setShowReviewModal(true)}
              className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 shadow-md shadow-blue-600/20"
            >
              <span>Review & Submit Ballot</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Pre-submission Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 font-sans">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Review Your Ballot</h3>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-900 font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Please confirm your vote selections for <strong className="text-slate-900">{event.name}</strong>. Once submitted, your ballot is permanent and cannot be changed.
            </p>

            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-in fade-in duration-200">
                {error}
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {event.categories.map((cat: any) => {
                const nomineeId = selectedVotes[cat.id];
                const nominee = cat.nominees.find((n: any) => n.id === nomineeId);

                return (
                  <div key={cat.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-bold truncate max-w-[180px]">{cat.name}</span>
                    {nominee ? (
                      <span className="text-emerald-700 font-extrabold">{nominee.name}</span>
                    ) : (
                      <span className="text-slate-400 italic font-medium">Skipped</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" size="md" onClick={() => setShowReviewModal(false)} className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-full">
                Go Back
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={submitting}
                onClick={handleCastBallot}
                className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20"
              >
                <Lock className="w-4 h-4 mr-1.5" />
                <span>Confirm & Submit</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
