"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Users,
  Vote,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Upload,
  Copy as CopyIcon,
  Image as ImageIcon,
  Layers,
  Settings as SettingsIcon,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Share2,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventDetailsAction, updateEventBrandingAction, duplicateEventAction, updateWorkflowStageStatusAction } from "@/actions/events";
import { updateEventSettingsAction } from "@/actions/voting";
import { BulkImportModal } from "@/components/import/bulk-import-modal";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "workflow" | "branding" | "settings">("overview");
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings tab form states
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PRIVATE");
  const [liveResultsMode, setLiveResultsMode] = useState<any>("HIDDEN");
  const [verificationMethod, setVerificationMethod] = useState<"NONE" | "EMAIL_OTP" | "INVITATION_CODE">("NONE");
  const [whitelistDomainsText, setWhitelistDomainsText] = useState("");
  const [whitelistEmailsText, setWhitelistEmailsText] = useState("");
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Branding tab form states
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#4f46e5");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [updatingBranding, setUpdatingBranding] = useState(false);
  const [brandingSuccess, setBrandingSuccess] = useState(false);

  // Duplication form states
  const [dupName, setDupName] = useState("");
  const [dupSlug, setDupSlug] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getEventDetailsAction(eventId);
        setEvent(data);
        if (data) {
          setVisibility(data.visibility || "PRIVATE");
          setLiveResultsMode(data.liveResultsMode || "HIDDEN");
          setVerificationMethod((data.verificationConfig as any)?.method || "NONE");
          setWhitelistDomainsText((data.audienceConfig as any)?.whitelistDomains?.join(", ") || "");
          setWhitelistEmailsText((data.audienceConfig as any)?.whitelistEmails?.join(", ") || "");
          
          // Load branding values
          setLogoUrl(data.branding?.logoUrl || "");
          setBannerUrl(data.branding?.bannerUrl || "");
          setPrimaryColor(data.branding?.primaryColor || "#6366f1");
          setSecondaryColor(data.branding?.secondaryColor || "#4f46e5");
          setAccentColor(data.branding?.accentColor || "#f59e0b");
        }
      } catch (err) {
        console.error("Failed to load event details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <p className="text-zinc-400 mt-2">The event you are looking for does not exist or has been deleted.</p>
        <Link href="/dashboard/events" className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Events
        </Link>
      </div>
    );
  }

  const currentStage = event.stages?.find((s: any) => s.status === 'ACTIVE') || event.stages?.find((s: any) => s.status === 'PENDING') || { displayName: 'Draft' };
  const nominationStage = event.stages?.find((s: any) => s.stageType === 'NOMINATIONS');
  const votingStage = event.stages?.find((s: any) => s.stageType === 'VOTING');
  const startDate = nominationStage?.startsAt ? new Date(nominationStage.startsAt).toLocaleDateString() : 'Not scheduled';
  const endDate = votingStage?.endsAt ? new Date(votingStage.endsAt).toLocaleDateString() : 'Not scheduled';

  const handleSaveSettings = async () => {
    setUpdatingSettings(true);
    setSettingsSuccess(false);
    try {
      const domains = whitelistDomainsText
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);
      const emails = whitelistEmailsText
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

      await updateEventSettingsAction(eventId, {
        visibility,
        liveResultsMode,
        verificationMethod,
        whitelistDomains: domains,
        whitelistEmails: emails,
      });

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update event settings:", err);
      alert("Error saving settings");
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleSaveBranding = async () => {
    setUpdatingBranding(true);
    setBrandingSuccess(false);
    try {
      await updateEventBrandingAction({
        eventId,
        logoUrl,
        bannerUrl,
        primaryColor,
        secondaryColor,
        accentColor,
      });
      setBrandingSuccess(true);
      setTimeout(() => setBrandingSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save event branding:", err);
      alert("Error saving branding assets settings.");
    } finally {
      setUpdatingBranding(false);
    }
  };

  const handleDuplicateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupName.trim() || !dupSlug.trim()) {
      alert("Please enter a name and unique URL slug for the duplicated event.");
      return;
    }
    setDuplicating(true);
    try {
      const cloned = await duplicateEventAction(eventId, dupName.trim(), dupSlug.trim().toLowerCase());
      alert(`Event duplicated successfully! Redirecting to new event draft...`);
      router.push(`/events/${cloned.id}`);
    } catch (err: any) {
      console.error("Duplication error:", err);
      alert(err.message || "Failed to duplicate event.");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/dashboard/events">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight">{event.name}</h1>
              <Badge variant={event.status === 'ACTIVE' ? 'success' : event.status === 'DRAFT' ? 'neutral' : 'purple'} size="sm">
                {event.status}
              </Badge>
              <Badge variant="purple" size="sm">Stage: {currentStage.displayName}</Badge>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Public Link: <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">awardos.io/e/{event.slug}</a>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4" />
              <span>Public Page</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={() => setShowBulkImportModal(true)} className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
            <Upload className="w-4 h-4" />
            <span>Bulk Import</span>
          </Button>
          <Link href={`/events/${eventId}/ai-cleanup`}>
            <Button variant="primary" size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600">
              <Sparkles className="w-4 h-4" />
              <span>Run AI Cleanup</span>
            </Button>
          </Link>
          <Link href={`/events/${eventId}/integrity`}>
            <Button variant="outline" size="sm" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
              <ShieldAlert className="w-4 h-4" />
              <span>Voting Integrity</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Center Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Overview", icon: Trophy },
          { id: "categories", label: `Categories (${event.categories.length})`, icon: Layers },
          { id: "workflow", label: "Workflow Pipeline", icon: Sparkles },
          { id: "branding", label: "Branding Assets", icon: ImageIcon },
          { id: "settings", label: "Event Settings", icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all select-none border-b-2 ${
                isActive
                  ? "text-indigo-400 border-indigo-500 bg-indigo-600/10"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Categories</span>
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-3xl font-bold text-white mt-2">{event.categories.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Total Nominations</span>
                  <Users className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-bold text-white mt-2">{event.nominationsCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Votes Cast</span>
                  <Vote className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-bold text-white mt-2">{event.votesCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Program Description & Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-300">
              <p className="leading-relaxed">{event.description}</p>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <span className="text-slate-500 block uppercase">Start Date</span>
                  <span className="font-semibold text-slate-200">{startDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase">End Date</span>
                  <span className="font-semibold text-slate-200">{endDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/events/${eventId}/results`}>
              <Card className="hover:border-indigo-500/50 cursor-pointer transition-all h-full bg-slate-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <CardTitle className="text-sm font-bold text-white">Official Results Manager</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Audit vote tallies, manage candidate disqualifications, and publish winners leaderboard to the public portal.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/analytics`}>
              <Card className="hover:border-indigo-500/50 cursor-pointer transition-all h-full bg-slate-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-400" />
                    <CardTitle className="text-sm font-bold text-white">Real-Time Analytics Hub</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Monitor voting velocity timeline charts, category turnout shares, and voter device telemetry.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/exports`}>
              <Card className="hover:border-indigo-500/50 cursor-pointer transition-all h-full bg-slate-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <CardTitle className="text-sm font-bold text-white">Data Export & Reports</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Generate and download spreadsheet records (CSV) of votes, nominations, and voter credentials.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/integrity`}>
              <Card className="hover:border-indigo-500/50 cursor-pointer transition-all h-full bg-slate-950/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <CardTitle className="text-sm font-bold text-white">Voting Integrity Panel</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Monitor network IP address clusters, duplicate browser footprints, and manage audit resolutions.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: Categories */}
      {activeTab === "categories" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Award Categories</CardTitle>
              <CardDescription>Manage the award categories for this event program.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/events/${eventId}/suggested-categories`}>
                <Button variant="outline" size="sm" className="border-purple-500/25 text-purple-400 hover:bg-purple-500/10 gap-1.5 flex items-center">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Suggested Inbox</span>
                </Button>
              </Link>
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {event.categories.map((cat: any, idx: number) => (
              <div
                key={cat.id}
                className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center justify-center border border-indigo-500/20">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{cat.name}</h4>
                    <p className="text-xs text-slate-400">{cat.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="purple" size="sm">{cat.count} Nominees</Badge>
                  <button className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Workflow Pipeline Control */}
      {activeTab === "workflow" && (
        <Card className="border-slate-800 bg-slate-950/20">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" /> Event Lifecycle Pipeline Control
            </CardTitle>
            <CardDescription className="text-xs">
              Manage stage transitions. Activating a stage automatically opens corresponding voter portals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.stages?.map((s: any, idx: number) => {
              const isActive = s.status === "ACTIVE";
              const isCompleted = s.status === "COMPLETED";

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isActive
                      ? "bg-indigo-950/20 border-indigo-500/50 shadow-lg shadow-indigo-950/50"
                      : isCompleted
                      ? "bg-slate-900/40 border-slate-850 opacity-80"
                      : "bg-slate-950/40 border-slate-850"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : isCompleted
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{s.displayName}</h4>
                        <Badge
                          variant={isActive ? "success" : isCompleted ? "purple" : "neutral"}
                          size="sm"
                        >
                          {s.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        Type: {s.stageType}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await updateWorkflowStageStatusAction(eventId, s.id, "ACTIVE");
                          window.location.reload();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-xs"
                      >
                        Activate Stage
                      </Button>
                    )}
                    {isActive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          await updateWorkflowStageStatusAction(eventId, s.id, "COMPLETED");
                          window.location.reload();
                        }}
                        className="text-xs"
                      >
                        Mark Completed
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Branding */}
      {activeTab === "branding" && (
        <Card className="border-slate-800 bg-slate-950/20">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Branding & Assets</CardTitle>
                <CardDescription>
                  Configure logos, banner imagery, and primary theme palettes.
                </CardDescription>
              </div>
              {brandingSuccess && (
                <Badge variant="success" size="sm">
                  ✓ Branding Saved Successfully!
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 max-w-2xl font-sans">
            {/* Image URLs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Logo Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Header Banner Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/banner.png"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Colors grid */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-900/60 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden shrink-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-2 py-1.5 border border-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Secondary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden shrink-0"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-2 py-1.5 border border-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Accent Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer overflow-hidden shrink-0"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-2 py-1.5 border border-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-slate-900/60 pt-4 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                disabled={updatingBranding}
                onClick={handleSaveBranding}
              >
                {updatingBranding ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                <span>Save Branding Assets</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Event Settings */}
      {activeTab === "settings" && (
        <>
          <Card className="border-slate-800 bg-slate-950/20">
          <CardHeader>
            <CardTitle>Event Settings</CardTitle>
            <CardDescription>
              Configure access visibility, verification mechanisms, and whitelists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-2xl font-sans">
            {/* Visibility Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Visibility</label>
              <select
                value={visibility}
                onChange={(e: any) => setVisibility(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="PUBLIC">Public (Visible on search and discovery)</option>
                <option value="UNLISTED">Unlisted (Accessible only via direct link)</option>
                <option value="PRIVATE">Private (Restricted access)</option>
              </select>
            </div>

            {/* Live Results Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Live Results Visibility</label>
              <select
                value={liveResultsMode}
                onChange={(e: any) => setLiveResultsMode(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="HIDDEN">Hidden (Only organizers can see live results)</option>
                <option value="RANKINGS">Rankings Only (Position without votes count)</option>
                <option value="PERCENTAGES">Percentages (Vote distribution percentage)</option>
                <option value="VOTE_COUNTS">Vote Counts (Raw counts only)</option>
                <option value="FULL_LEADERBOARD">Full Leaderboard (Complete list with counts)</option>
              </select>
            </div>

            {/* Verification Method Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Voter Authentication & Verification Method</label>
              <select
                value={verificationMethod}
                onChange={(e: any) => setVerificationMethod(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
              >
                <option value="NONE">None (Guest voting, standard tracking only)</option>
                <option value="EMAIL_OTP">Email OTP Verification (Verifies real emails via 6-digit code)</option>
                <option value="INVITATION_CODE">Invitation Code Authentication (Unique single-use code)</option>
              </select>
            </div>

            {/* Email OTP Whitelist Settings (conditional) */}
            {verificationMethod === "EMAIL_OTP" && (
              <div className="space-y-4 pt-2 border-t border-slate-800/80 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Whitelist Domains</label>
                  <CardDescription className="text-[10px] pb-1">
                    Comma-separated list of allowed domains (e.g. <code className="text-indigo-400">college.edu, company.com</code>). Leave empty to allow any domain.
                  </CardDescription>
                  <textarea
                    value={whitelistDomainsText}
                    onChange={(e) => setWhitelistDomainsText(e.target.value)}
                    placeholder="college.edu, company.com"
                    rows={2}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Whitelist Emails</label>
                  <CardDescription className="text-[10px] pb-1">
                    Comma-separated list of specific whitelisted emails. Leave empty to ignore.
                  </CardDescription>
                  <textarea
                    value={whitelistEmailsText}
                    onChange={(e) => setWhitelistEmailsText(e.target.value)}
                    placeholder="voter1@college.edu, voter2@college.edu"
                    rows={2}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Invitation Code Admin Link (conditional) */}
            {verificationMethod === "INVITATION_CODE" && (
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-xs space-y-3 animate-in fade-in duration-300">
                <p className="text-slate-400 leading-relaxed">
                  Authentication requires voters to input unique, single-use invite codes. You can generate, manage, and distribute these codes in the Invitation Panel.
                </p>
                <Link href={`/events/${eventId}/invitations`}>
                  <Button variant="outline" size="sm" className="border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/10">
                    Manage Invitation Codes
                  </Button>
                </Link>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-800/80">
              <Button
                variant="primary"
                onClick={handleSaveSettings}
                disabled={updatingSettings}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {updatingSettings ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
                ) : null}
                <span>Save Settings</span>
              </Button>
              {settingsSuccess && (
                <span className="text-xs text-emerald-400 font-medium animate-in fade-in duration-300">
                  Settings updated successfully!
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Duplication Card */}
        <Card className="border-slate-800 bg-slate-950/20 mt-6">
          <CardHeader>
            <CardTitle>Duplicate Event as Template</CardTitle>
            <CardDescription>
              Deep-copy this event configuration (categories, nominee lists, and stages) to scaffold a new event instantly. Results, votes, and guest telemetry will be reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl font-sans">
            <form onSubmit={handleDuplicateEvent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">New Event Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Next Year Excellence Awards"
                    value={dupName}
                    onChange={(e) => setDupName(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">New Event Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. next-year-excellence-2027"
                    value={dupSlug}
                    onChange={(e) => setDupSlug(e.target.value)}
                    className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={duplicating}
                  className="bg-indigo-600 hover:bg-indigo-500 border-indigo-400/25 text-white"
                >
                  {duplicating ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <CopyIcon className="w-4 h-4 mr-2" />
                  )}
                  <span>Clone Event Draft</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </>
      )}

      <BulkImportModal
        eventId={eventId}
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          setShowBulkImportModal(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
