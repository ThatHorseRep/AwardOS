"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Vote, ShieldCheck, Eye, ExternalLink, Sliders, TrendingUp, Loader2, Calendar, Check, Globe, BarChart2, Users, Fingerprint, MessageSquare } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { getEventsAction, updateBallotSettingsAction } from "@/actions/events";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";

type EventSummary = Awaited<ReturnType<typeof getEventsAction>>[number];
type VerificationMethod = "NONE" | "EMAIL_OTP" | "INVITATION_CODE";
type LiveResultsMode = "HIDDEN" | "PERCENTAGES" | "VOTE_COUNTS" | "FULL_LEADERBOARD";
type AudienceType = "PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS";
type VerificationConfig = { method?: VerificationMethod };

export default function OrganizerVotingPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eventList, setEventList] = useState<EventSummary[]>([]);

  // Ballot settings modal state
  const [selectedEventForSettings, setSelectedEventForSettings] = useState<EventSummary | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>("NONE");
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("UNLISTED");
  const [liveResultsMode, setLiveResultsMode] = useState<LiveResultsMode>("FULL_LEADERBOARD");
  const [audienceType, setAudienceType] = useState<AudienceType>("PUBLIC");

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true); setLoadError(false);
    try {
      const events = await getEventsAction();
      setEventList(events || []);
    } catch (err) {
      console.error("Failed to load voting dashboard:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openSettingsModal = (ev: EventSummary) => {
    setSelectedEventForSettings(ev);
    const existingMethod = (ev.verificationConfig as VerificationConfig | null)?.method || (ev.verificationLevel === "ADVANCED" ? "INVITATION_CODE" : ev.verificationLevel === "STANDARD" ? "EMAIL_OTP" : "NONE");
    setVerificationMethod(existingMethod);
    setVisibility(ev.visibility || "PUBLIC");
    setLiveResultsMode(ev.liveResultsMode === "RANKINGS" ? "FULL_LEADERBOARD" : ev.liveResultsMode || "FULL_LEADERBOARD");
    setAudienceType(ev.audienceType || "PUBLIC");
    setSaveSuccess(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForSettings) return;

    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const verificationLevel = verificationMethod === "INVITATION_CODE" ? "ADVANCED" : "STANDARD";
      await updateBallotSettingsAction({
        eventId: selectedEventForSettings.id,
        verificationMethod,
        verificationLevel,
        visibility,
        liveResultsMode,
        audienceType,
      });

      setSaveSuccess(true);
      await loadData();
      setTimeout(() => {
        setSaveSuccess(false);
        setSelectedEventForSettings(null);
      }, 1500);
    } catch (err: unknown) {
      console.error("Failed to save ballot settings:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update ballot settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }
  if (loadError) return <LoadError onRetry={() => void loadData()} />;

  const activeEvents = eventList.filter((e) => e.status === "ACTIVE");

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16 pt-2 select-none animate-page-entrance text-content">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
            <Vote className="w-6 h-6 text-accent" />
            <span>Voting & ballot control center</span>
          </h1>
          <p className="text-content-secondary text-xs mt-1 font-normal">
            Configure ballot security, manage voter verification, and preview live voting portals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href="/nominations">
            <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              <span>Manage nominees</span>
            </Button>
          </Link>

          {eventList.length > 0 && (
            <Link href={`/e/${eventList[0].slug}/vote`} target="_blank">
              <Button variant="primary" size="sm" className="rounded-xl font-semibold text-xs px-4">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                <span>Open public ballot</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="border-border-subtle bg-surface-raised rounded-2xl shadow-sm text-content">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base font-bold text-content">Nominee management</CardTitle>
          <CardDescription className="text-xs text-content-secondary font-normal">
            Review raw nominations, merge duplicates, and ensure the candidate roster is ready before voting opens.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 text-xs text-content font-normal">
            <p>Connect raw entries to official nominees before launching the ballot.</p>
            <p className="text-content-secondary">This maintains a clean pipeline from nominations through candidate validation into the voting hub.</p>
          </div>
          <Link href="/nominations">
            <Button variant="primary" size="sm" className="rounded-xl font-semibold text-xs px-4">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              <span>Open nominee inbox</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
          <div>
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Total programs</span>
            <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{eventList.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
          <div>
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Active sessions</span>
            <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{activeEvents.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-success flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
          <div>
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Security method</span>
            <span className="text-lg font-bold text-content mt-1 block">MULTI-METHOD</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
          <div>
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Fraud protection</span>
            <span className="text-lg font-bold text-success mt-1 block">ACTIVE</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-success flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Voting Programs */}
      <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
        <CardHeader className="border-b border-border-subtle pb-4">
          <CardTitle className="text-base font-bold text-content">Configured voting programs</CardTitle>
          <CardDescription className="text-xs text-content-secondary font-normal">Live balloting status, security verification levels, and settings per event.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {eventList.length === 0 ? (
            <div className="text-center py-8 text-content-secondary text-xs italic font-normal">
              No event programs created yet.
            </div>
          ) : (
            eventList.map((ev) => {
              const currentMethod = (ev.verificationConfig as VerificationConfig | null)?.method || (ev.verificationLevel === "ADVANCED" ? "INVITATION_CODE" : ev.verificationLevel === "STANDARD" ? "EMAIL_OTP" : "NONE");

              return (
                <div
                  key={ev.id}
                  className="p-5 rounded-xl bg-surface-raised border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-content">{ev.name}</h4>
                      <Badge variant={ev.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                        {ev.status.toLowerCase()}
                      </Badge>
                      <Badge variant="default" size="sm" className="font-mono text-xs">
                        {ev.liveResultsMode || "FULL_LEADERBOARD"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-content-secondary font-normal">
                      <span>Visibility: <strong className="text-content font-medium">{ev.visibility}</strong></span>
                      <span>•</span>
                      <span>Integrity: <strong className="text-content font-medium">{currentMethod === "NONE" ? "Frictionless cookie & fingerprint" : currentMethod === "EMAIL_OTP" ? "Email OTP" : "Restricted voter PIN"}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <Link href={`/e/${ev.slug}/vote`} target="_blank">
                      <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>View ballot</span>
                      </Button>
                    </Link>

                    <button
                      type="button"
                      onClick={() => openSettingsModal(ev)}
                      className="px-3.5 py-1.5 rounded-xl bg-surface border border-border-subtle hover:bg-surface-raised text-content font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Sliders className="w-3.5 h-3.5 text-accent" />
                      <span>Ballot settings</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Ballot Settings Configurator Modal */}
      {selectedEventForSettings && (
        <Modal
          open
          onClose={() => setSelectedEventForSettings(null)}
          title="Ballot settings"
          description={selectedEventForSettings.name}
          size="md"
        >
            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              {/* 1. Voter Authentication & Security Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-accent" />
                  <span>Voter authentication & integrity method</span>
                </label>
                <select
                  value={verificationMethod}
                  onChange={(e) => setVerificationMethod(e.target.value as VerificationMethod)}
                  className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                >
                  <option value="NONE">Frictionless — Cookie & device fingerprint (1-click voting)</option>
                  <option value="EMAIL_OTP">Standard — Email passcode (6-digit OTP verification)</option>
                  <option value="INVITATION_CODE">Advanced — Restricted voter PIN code / secret token</option>
                </select>
                <div className="p-3 rounded-xl bg-surface-raised border border-border-subtle text-xs text-content-secondary leading-relaxed font-normal">
                  {verificationMethod === "NONE" ? (
                    <span className="text-success font-medium">
                      ✓ Frictionless mode: Voters vote immediately in 1 click without entering emails or PINs. HTTP-only cookies and IP rate limiting prevent double voting.
                    </span>
                  ) : verificationMethod === "EMAIL_OTP" ? (
                    <span className="text-accent font-medium">
                      ✓ Standard mode: Voters enter their email and receive a 6-digit verification code to confirm their ballot.
                    </span>
                  ) : (
                    <span className="text-accent font-medium">
                      ✓ Advanced mode: Voters must enter a pre-generated single-use PIN code or invitation token to cast a ballot.
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Program Visibility */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-accent" />
                  <span>Program visibility</span>
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                  className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                >
                  <option value="UNLISTED">Link only: accessible through the organizer&apos;s shared URL</option>
                  <option value="PUBLIC">Public: accessible to anyone with the URL</option>
                  <option value="PRIVATE">Private: restricted to the organizer workspace</option>
                </select>
              </div>

              {/* 3. Live Results Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-accent" />
                  <span>Live results leaderboard visibility</span>
                </label>
                <select
                  value={liveResultsMode}
                  onChange={(e) => setLiveResultsMode(e.target.value as LiveResultsMode)}
                  className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                >
                  <option value="FULL_LEADERBOARD">Full leaderboard — Show rank, percentages & raw vote counts</option>
                  <option value="PERCENTAGES">Percentages only — Hide raw vote counts, show percentages</option>
                  <option value="VOTE_COUNTS">Vote counts only — Show raw vote totals</option>
                  <option value="HIDDEN">Hidden / locked — Lock live results until official publication</option>
                </select>
              </div>

              {/* 4. Target Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Target audience group</span>
                </label>
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                  className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                >
                  <option value="PUBLIC">General public</option>
                  <option value="STUDENTS">Students & campus</option>
                  <option value="FACULTY">Faculty & staff</option>
                  <option value="ALUMNI">Alumni network</option>
                  <option value="INVITE_ONLY">Invite only guests</option>
                </select>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-success/10 border border-success/20 text-success font-semibold text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span>Ballot settings saved</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setSelectedEventForSettings(null)}
                  className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-muted text-content font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="rounded-xl font-semibold text-xs px-4"
                >
                  {savingSettings ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  <span>Save ballot settings</span>
                </Button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
