"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Vote,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sliders,
  TrendingUp,
  Loader2,
  Calendar,
  X,
  Check,
  Key,
  Lock,
  Globe,
  BarChart2,
  Users,
  Fingerprint,
  MessageSquare,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventsAction, updateBallotSettingsAction } from "@/actions/events";

export default function OrganizerVotingPage() {
  const [loading, setLoading] = useState(true);
  const [eventList, setEventList] = useState<any[]>([]);

  // Ballot settings modal state
  const [selectedEventForSettings, setSelectedEventForSettings] = useState<any | null>(null);
  const [verificationMethod, setVerificationMethod] = useState<"NONE" | "EMAIL_OTP" | "INVITATION_CODE">("NONE");
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [liveResultsMode, setLiveResultsMode] = useState<"FULL_LEADERBOARD" | "PERCENTAGES" | "VOTE_COUNTS" | "HIDDEN">("FULL_LEADERBOARD");
  const [audienceType, setAudienceType] = useState<"PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS">("PUBLIC");

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadData = async () => {
    try {
      const events = await getEventsAction();
      setEventList(events || []);
    } catch (err) {
      console.error("Failed to load voting dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openSettingsModal = (ev: any) => {
    setSelectedEventForSettings(ev);
    const existingMethod = ev.verificationConfig?.method || (ev.verificationLevel === "ADVANCED" ? "INVITATION_CODE" : ev.verificationLevel === "STANDARD" ? "EMAIL_OTP" : "NONE");
    setVerificationMethod(existingMethod as any);
    setVisibility(ev.visibility || "PUBLIC");
    setLiveResultsMode(ev.liveResultsMode || "FULL_LEADERBOARD");
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
    } catch (err: any) {
      console.error("Failed to save ballot settings:", err);
      alert(err.message || "Failed to update ballot settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const activeEvents = eventList.filter((e) => e.status === "ACTIVE" || e.status === "VOTING");

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16 pt-2 sm:pt-4 select-none">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Vote className="w-6 h-6 text-blue-600" />
            <span>Voting & Ballot Control Center</span>
          </h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Configure ballot security, manage voter PIN authentication, and preview live voting portals.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/dashboard/nominations">
            <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm font-bold">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              <span>Manage Nominees</span>
            </Button>
          </Link>

          {eventList.length > 0 && (
            <Link href={`/e/${eventList[0].slug}/vote`} target="_blank">
              <Button variant="primary" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                <span>Open Public Ballot</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">Nominee Management</CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium">
            Review raw nominations, merge duplicates, and ensure the candidate roster is ready before voting opens.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 text-sm text-slate-700">
            <p className="font-medium">Open the nomination inbox and connect raw entries to official nominees before launching the ballot.</p>
            <p className="text-xs text-slate-500">This helps maintain a direct process from nominations through candidate validation into the voting hub.</p>
          </div>
          <Link href="/dashboard/nominations">
            <Button variant="primary" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              <span>Open Nominee Inbox</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Programs</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{eventList.length}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Active Sessions</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{activeEvents.length}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Security Method</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">MULTI-METHOD</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Fraud Protection</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">ACTIVE</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Voting Programs */}
      <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">Configured Voting Programs</CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium">Live balloting status, security verification levels, and settings per event.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {eventList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic font-medium">
              No event programs created yet.
            </div>
          ) : (
            eventList.map((ev) => {
              const currentMethod = ev.verificationConfig?.method || (ev.verificationLevel === "ADVANCED" ? "INVITATION_CODE" : ev.verificationLevel === "STANDARD" ? "EMAIL_OTP" : "NONE");

              return (
                <div
                  key={ev.id}
                  className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{ev.name}</h4>
                      <Badge variant={ev.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                        {ev.status}
                      </Badge>
                      <Badge variant="purple" size="sm" className="font-mono text-[10px]">
                        {ev.liveResultsMode || "FULL_LEADERBOARD"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                      <span>Visibility: <strong className="text-slate-900">{ev.visibility}</strong></span>
                      <span>•</span>
                      <span>Integrity: <strong className="text-slate-900">{currentMethod === "NONE" ? "Frictionless Cookie & Fingerprint" : currentMethod === "EMAIL_OTP" ? "Email OTP" : "Restricted Voter PIN"}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link href={`/e/${ev.slug}/vote`} target="_blank">
                      <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm font-bold">
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>View Public Ballot</span>
                      </Button>
                    </Link>

                    <button
                      type="button"
                      onClick={() => openSettingsModal(ev)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border border-slate-800"
                    >
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Ballot Settings</span>
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
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans">
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 my-auto max-h-[85vh] overflow-y-auto">
            {/* Sticky Header inside modal */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10 pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Ballot Settings
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate max-w-xs">
                    {selectedEventForSettings.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEventForSettings(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              {/* 1. Voter Authentication & Security Method */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-blue-600" />
                  <span>Voter Authentication & Integrity Method</span>
                </label>
                <select
                  value={verificationMethod}
                  onChange={(e: any) => setVerificationMethod(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="NONE">⚡ Frictionless — Browser Cookie & Device Fingerprint (1-Click Voting, No Email/PIN required)</option>
                  <option value="EMAIL_OTP">✉️ Standard — Email Passcode (6-Digit OTP Verification)</option>
                  <option value="INVITATION_CODE">🔑 Advanced — Restricted Voter PIN Code / Secret Access Tokens</option>
                </select>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed font-medium">
                  {verificationMethod === "NONE" ? (
                    <span className="text-emerald-700 font-semibold">
                      ✓ Frictionless Mode: Voters vote immediately in 1 click without entering emails or PINs! HTTP-only cookies (<code className="text-slate-900">awardos_voted_...</code>) & IP rate limiting prevent double voting.
                    </span>
                  ) : verificationMethod === "EMAIL_OTP" ? (
                    <span className="text-blue-700 font-semibold">
                      ✓ Standard Mode: Voters enter their email and receive a 6-digit verification code to confirm their ballot.
                    </span>
                  ) : (
                    <span className="text-purple-700 font-semibold">
                      ✓ Advanced Mode: Voters must enter a pre-generated single-use PIN code or invitation token to cast a ballot.
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Program Visibility */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-purple-600" />
                  <span>Program Visibility</span>
                </label>
                <select
                  value={visibility}
                  onChange={(e: any) => setVisibility(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="PUBLIC">Public — Discoverable on Search & Open Public Ballot URL</option>
                  <option value="UNLISTED">Unlisted — Accessible via Direct Link Only (Hidden from Search)</option>
                  <option value="PRIVATE">Private — Restricted Workspace Access Only</option>
                </select>
              </div>

              {/* 3. Live Results Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-emerald-600" />
                  <span>Live Results Leaderboard Visibility</span>
                </label>
                <select
                  value={liveResultsMode}
                  onChange={(e: any) => setLiveResultsMode(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="FULL_LEADERBOARD">Full Leaderboard — Show Rank, Percentages & Raw Vote Counts</option>
                  <option value="PERCENTAGES">Percentages Only — Hide Raw Vote Counts, Show Percentages</option>
                  <option value="VOTE_COUNTS">Vote Counts Only — Show Raw Vote Totals</option>
                  <option value="HIDDEN">Hidden / Locked — Lock Live Results Until Official Publication</option>
                </select>
              </div>

              {/* 4. Target Audience */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>Target Audience Group</span>
                </label>
                <select
                  value={audienceType}
                  onChange={(e: any) => setAudienceType(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="PUBLIC">General Public</option>
                  <option value="STUDENTS">Students & Campus</option>
                  <option value="FACULTY">Faculty & Staff</option>
                  <option value="ALUMNI">Alumni Network</option>
                  <option value="INVITE_ONLY">Invite Only Guests</option>
                </select>
              </div>

              {saveSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Ballot Settings saved successfully!</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedEventForSettings(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={savingSettings}
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 shadow-md shadow-blue-600/20"
                >
                  {savingSettings ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
                  ) : (
                    <Check className="w-4 h-4 mr-1.5" />
                  )}
                  <span>Save Ballot Configurations</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
