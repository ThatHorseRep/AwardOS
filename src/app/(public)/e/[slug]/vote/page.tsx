"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  getPublicBallotDetailsAction,
  sendEmailOtpAction,
  verifyEmailOtpAction,
  verifyInvitationCodeAction,
} from "@/actions/voting";
import { INVITATION_CODE_LENGTH } from "@/lib/constants";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { LoadError } from "@/components/shared/load-error";

type PublicBallot = Awaited<ReturnType<typeof getPublicBallotDetailsAction>>;
type VerificationSession =
  | { method: "EMAIL_OTP"; email: string; otpId: string }
  | { method: "INVITATION_CODE"; code: string };

export default function PublicBallotPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [event, setEvent] = useState<PublicBallot>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
  const [verificationSession, setVerificationSession] = useState<VerificationSession | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!resendAvailableAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  const loadData = useCallback(async () => {
      setLoading(true); setLoadError(false);
      try {
        const data = await getPublicBallotDetailsAction(slug);
        if (!data) return;
        setEvent(data);
        const sessionKey = `awardos_session_id_${slug}`;
        let ballotSessionId = localStorage.getItem(sessionKey);
        if (!ballotSessionId) { ballotSessionId = `sess_${crypto.randomUUID()}`; localStorage.setItem(sessionKey, ballotSessionId); }
        const sessionResponse = await fetchWithTimeout(`/api/public/events/${slug}/ballot-session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: ballotSessionId }) }, 60_000);
        if (!sessionResponse.ok) throw new Error("The ballot session could not be initialized.");

        // "Already voted" is decided server-side from the HTTP-only ballot cookie.
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
        setLoadError(true);
      } finally {
        setLoading(false);
      }
  }, [slug]);
  useEffect(() => { void loadData(); }, [loadData]);

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
      if (!event) return;
      const result = await sendEmailOtpAction(event.id, email.trim());
      if (result.success) {
        setOtpId(result.otpId);
        if (result.developmentCode) setError(`Development verification code: ${result.developmentCode}`);
        setVerificationStep("OTP");
        setNow(Date.now());
        setResendAvailableAt(Date.now() + 60_000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
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
      if (!event) return;
      const result = await verifyEmailOtpAction(event.id, email.trim(), otpCode.trim());
      if (result.success) {
        setVerificationSession({
          method: "EMAIL_OTP",
          email: email.trim(),
          otpId: result.otpId,
        });
        setVerificationStep("BALLOT");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired verification code.");
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
      if (!event) return;
      const result = await verifyInvitationCodeAction(event.id, invitationCode.trim());
      if (result.success) {
        setVerificationSession({
          method: "INVITATION_CODE",
          code: invitationCode.trim().toUpperCase(),
        });
        setVerificationStep("BALLOT");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid or expired invitation code.");
    } finally {
      setVerifying(false);
    }
  };

  // Cast Ballot Handler
  const handleCastBallot = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const sessionKey = `awardos_session_id_${slug}`;
      let sessionId = localStorage.getItem(sessionKey);
      if (!sessionId) {
        sessionId = `sess_${crypto.randomUUID()}`;
        localStorage.setItem(sessionKey, sessionId);
      }

      if (!event) return;
      const votesPayload = event.categories.map((cat) => ({
        categoryId: cat.id,
        nomineeId: selectedVotes[cat.id] || null,
        skipped: !selectedVotes[cat.id],
      }));

      const response = await fetchWithTimeout(`/api/public/events/${slug}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          votes: votesPayload,
          sessionId,
          ...(verificationSession ? { verificationSession } : {}),
        }),
      }, 20_000);

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && /already cast|already submitted/i.test(String(data.error ?? ""))) {
          router.replace(`/e/${slug}/vote/thank-you`);
          return;
        }
        throw new Error(data.error || "Failed to submit ballot.");
      }

      setHasVoted(true);
      localStorage.setItem(`awardos_receipt_${slug}`, data.receipt);
      router.push(`/e/${slug}/vote/thank-you`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred submitting your ballot.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite" aria-label="Loading ballot">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" aria-hidden="true" />
      </div>
    );
  }

  if (loadError) return <LoadError message="We could not load this ballot." onRetry={() => void loadData()} />;

  if (!event) {
    return (
      <Card className="border-border-subtle bg-surface rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm font-sans select-none my-12 text-content">
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3 border border-destructive/20">
            <Info className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-content">Event not found</CardTitle>
          <CardDescription className="text-xs text-content-secondary font-medium mt-1">
            The requested award event could not be found.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isVotingActive = event.status === "ACTIVE";

  if (!isVotingActive) {
    return (
      <Card className="border-border-subtle bg-surface rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm font-sans select-none my-12 text-content">
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
            <Info className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-content">Voting period closed or pending</CardTitle>
          <CardDescription className="text-xs text-content-secondary font-medium mt-1">
            Voting is not currently active for {event?.name || "this event"}. Please check the event schedule for updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Link href={`/e/${slug}`}>
            <Button variant="primary" className="px-5 py-2.5 rounded-xl font-semibold text-xs">
              Return to event program
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const totalSelected = Object.keys(selectedVotes).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-24">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm" className="text-content-secondary hover:text-content">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back to event</span>
          </Button>
        </Link>

        <Badge variant="success" size="sm" className="gap-1.5 flex items-center">
          <Vote className="w-3 h-3" /> Voting ballot live
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight">Official voter ballot</h1>
        <p className="text-content-secondary text-xs max-w-lg mx-auto leading-relaxed font-normal">
          Select one candidate per category for <strong className="text-content font-bold">{event.name}</strong>. Your vote is write-once and protected against duplicate submissions.
        </p>
      </div>

      {hasVoted && (
        <div className="p-4 rounded-2xl bg-success/10 border border-success/20 text-success text-xs flex items-center justify-between gap-3 animate-page-entrance font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>You have already cast a ballot for this event. Ballots are write-once and immutable.</span>
          </div>
          <Link href={`/e/${slug}/vote/thank-you`}>
            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl">
              View confirmation
            </Button>
          </Link>
        </div>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {verificationStep === "OTP" && `Verification code sent to ${email}.`}
        {verificationStep === "BALLOT" && verificationSession && "Identity verified. Ballot ready."}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold animate-page-entrance" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* STEP 1: Email Input View */}
      {verificationStep === "EMAIL" && !hasVoted && (
        <Card className="max-w-md mx-auto border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" />
              <CardTitle className="text-base font-bold text-content">Email verification</CardTitle>
            </div>
            <CardDescription className="text-xs text-content-secondary font-normal">
              Voter authentication is required. Enter your email to receive a 6-digit access code.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSendOtp} className="space-y-4">
              <label htmlFor="voter-email" className="block text-xs font-semibold text-content">Email address</label>
              <input
                id="voter-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voter@college.edu"
                className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2.5 border border-border-subtle focus:outline-none focus:border-accent font-normal"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={verifying}
                className="w-full rounded-xl font-semibold text-xs shadow-sm"
              >
                {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                <span>Send access code</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: OTP Verification Code View */}
      {verificationStep === "OTP" && !hasVoted && (
        <Card className="max-w-md mx-auto border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-accent" />
              <CardTitle className="text-base font-bold text-content">Enter verification code</CardTitle>
            </div>
            <CardDescription className="text-xs text-content-secondary font-normal">
              We sent a 6-digit authentication code to <strong className="text-content">{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <label htmlFor="voter-otp" className="block text-xs font-semibold text-content">Six digit verification code</label>
              <input
                id="voter-otp"
                name="otp"
                type="text"
                required
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full bg-surface-raised text-center text-content text-lg tracking-widest rounded-xl px-4 py-2.5 border border-border-subtle focus:outline-none focus:border-accent font-mono font-bold"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={verifying || otpCode.length < 6}
                className="w-full rounded-xl font-semibold text-xs shadow-sm"
              >
                {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                <span>Verify & access ballot</span>
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (Date.now() >= resendAvailableAt) {
                    setVerificationStep("EMAIL");
                  }
                }}
                disabled={Date.now() < resendAvailableAt}
                className="w-full text-center text-xs text-content-secondary hover:text-content flex items-center justify-center gap-1 mt-2 font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>
                  {Date.now() < resendAvailableAt
                    ? `Request another code in ${Math.ceil((resendAvailableAt - now) / 1000)}s`
                    : "Request another code"}
                </span>
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Invitation Code Authentication View */}
      {verificationStep === "INVITATION_CODE" && !hasVoted && (
        <Card className="max-w-md mx-auto border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-accent" />
              <CardTitle className="text-base font-bold text-content">Invitation code required</CardTitle>
            </div>
            <CardDescription className="text-xs text-content-secondary font-normal">
              This event is private. Please enter your unique 8-character invitation credential.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleVerifyInvitation} className="space-y-4">
              <label htmlFor="invitation-code" className="block text-xs font-semibold text-content">Invitation code</label>
              <input
                id="invitation-code"
                name="invitationCode"
                type="text"
                required
                autoComplete="off"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                placeholder="Enter your code"
                className="w-full bg-surface-raised text-center text-content text-base tracking-widest rounded-xl px-4 py-2.5 border border-border-subtle focus:outline-none focus:border-accent font-mono font-bold uppercase"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={verifying || invitationCode.trim().length < INVITATION_CODE_LENGTH}
                className="w-full rounded-xl font-semibold text-xs shadow-sm"
              >
                {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                <span>Authenticate & access ballot</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Live Ballot Form view */}
      {verificationStep === "BALLOT" && !hasVoted && (
        <div className="space-y-6">
          <div className="space-y-6">
            {event.categories.map((cat, idx: number) => {
              const selectedNomineeId = selectedVotes[cat.id];

              return (
                <Card key={cat.id} className="border-border-subtle bg-surface rounded-2xl shadow-sm">
                  <CardHeader className="pb-3 border-b border-border-subtle flex flex-row items-center justify-between space-y-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" size="sm">Category 0{idx + 1}</Badge>
                        {selectedNomineeId && (
                          <Badge variant="success" size="sm">
                            <Check className="w-3 h-3" /> Voted
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base text-content font-bold mt-1.5">{cat.name}</CardTitle>
                      {cat.description && <CardDescription className="text-xs text-content-secondary font-normal leading-relaxed mt-1">{cat.description}</CardDescription>}
                    </div>

                    {selectedNomineeId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSkipCategory(cat.id)}
                        className="text-xs text-content-secondary hover:text-content font-semibold"
                      >
                        Clear selection
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-3 pt-4">
                    {cat.nominees.length === 0 ? (
                      <div className="text-content-secondary text-xs italic py-4 font-normal">No candidate configured in this category.</div>
                    ) : (
                      <fieldset className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <legend className="sr-only">
                          Choose a nominee for {cat.name}
                        </legend>
                        {cat.nominees.map((nom) => {
                          const isSelected = selectedNomineeId === nom.id;

                          return (
                            <label
                              key={nom.id}
                              className={`relative p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 active:scale-[0.98] focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 ${
                                isSelected
                                  ? "bg-accent/10 border-accent text-content shadow-sm"
                                  : "bg-surface-raised border-border-subtle hover:border-accent/40 text-content"
                              }`}
                            >
                              <input
                                type="radio"
                                name={`category-${cat.id}`}
                                value={nom.id}
                                checked={isSelected}
                                onChange={() =>
                                  handleSelectNominee(cat.id, nom.id)
                                }
                                className="sr-only"
                              />
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={nom.name} size="sm" />
                                  <div>
                                    <h3 className="text-xs font-bold text-content leading-tight">{nom.name}</h3>
                                  </div>
                                </div>

                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                    isSelected
                                      ? "bg-accent border-accent text-accent-contrast"
                                      : "border-border-subtle bg-surface"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>

                              {nom.bio && (
                                <p className="text-xs text-content-secondary leading-relaxed line-clamp-3 font-normal">
                                  {nom.bio}
                                </p>
                              )}
                            </label>
                          );
                        })}
                      </fieldset>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Floating Bottom Island Bar */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-2xl p-3.5 rounded-2xl bg-surface/95 text-content border border-border-subtle shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 z-40 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent text-accent-contrast flex items-center justify-center font-bold text-xs shadow-sm tabular-nums">
                {totalSelected}/{event.categories.length}
              </div>
              <div>
                <span className="text-xs font-bold text-content block">
                  {totalSelected === 0
                    ? "No selections made yet"
                    : `${totalSelected} of ${event.categories.length} categories voted`}
                </span>
                <span className="text-xs text-content-secondary font-medium">
                  {totalSelected < event.categories.length ? "You can skip unselected categories" : "All categories selected"}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={totalSelected === 0 || hasVoted}
              onClick={() => setShowReviewModal(true)}
              className="rounded-xl px-5 py-2 text-xs font-semibold shadow-sm"
            >
              <span>Review ballot</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Pre-submission Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-page-entrance font-sans">
          <div role="dialog" aria-modal="true" aria-labelledby="ballot-review-title" className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto bg-surface border border-border-subtle rounded-2xl p-6 space-y-5 shadow-2xl text-content">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h3 id="ballot-review-title" className="text-base font-bold text-content">Review your ballot</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)} 
                aria-label="Close modal"
                className="text-content-secondary hover:text-content font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-content-secondary leading-relaxed font-normal">
              Please confirm your vote selections for <strong className="text-content font-bold">{event.name}</strong>. Once submitted, your ballot is permanent and cannot be changed.
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold animate-page-entrance" role="alert">
                {error}
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {event.categories.map((cat) => {
                const nomineeId = selectedVotes[cat.id];
                const nominee = cat.nominees.find((n) => n.id === nomineeId);

                return (
                  <div key={cat.id} className="p-3 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-between text-xs">
                    <span className="text-content font-semibold truncate max-w-[180px]">{cat.name}</span>
                    {nominee ? (
                      <span className="text-success font-bold">{nominee.name}</span>
                    ) : (
                      <span className="text-content-secondary italic font-normal">Skipped</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" size="md" onClick={() => setShowReviewModal(false)} className="flex-1 rounded-xl text-xs font-semibold">
                Go back
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={submitting}
                onClick={handleCastBallot}
                className="flex-1 rounded-xl bg-success hover:bg-success/90 text-white font-semibold text-xs shadow-sm"
              >
                <Lock className="w-4 h-4 mr-1.5" />
                <span>Confirm & submit</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
