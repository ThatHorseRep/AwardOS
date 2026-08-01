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
  ChevronDown,
  ChevronUp,
  Save,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getEventDetailsAction,
  updateEventBrandingAction,
  duplicateEventAction,
  updateWorkflowStageStatusAction,
  updateEventTimelineAction,
} from "@/actions/events";
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
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<{ [catId: string]: boolean }>({});

  // Timeline / Schedule state
  const [stageDates, setStageDates] = useState<{ [stageId: string]: { startsAt: string; endsAt: string } }>({});
  const [updatingTimeline, setUpdatingTimeline] = useState(false);
  const [timelineSuccess, setTimelineSuccess] = useState(false);

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
  const [primaryColor, setPrimaryColor] = useState("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState("#1d4ed8");
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
          setPrimaryColor(data.branding?.primaryColor || "#2563eb");
          setSecondaryColor(data.branding?.secondaryColor || "#1d4ed8");
          setAccentColor(data.branding?.accentColor || "#f59e0b");

          // Load timeline stage dates
          if (data.stages) {
            const datesMap: any = {};
            data.stages.forEach((s: any) => {
              datesMap[s.id] = {
                startsAt: s.startsAt ? new Date(s.startsAt).toISOString().slice(0, 16) : "",
                endsAt: s.endsAt ? new Date(s.endsAt).toISOString().slice(0, 16) : "",
              };
            });
            setStageDates(datesMap);
          }
        }
      } catch (err) {
        console.error("Failed to load event details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [eventId]);

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategoryIds((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleStageDateChange = (stageId: string, field: "startsAt" | "endsAt", value: string) => {
    setStageDates((prev) => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        [field]: value,
      },
    }));
  };

  const handleSaveTimeline = async () => {
    setUpdatingTimeline(true);
    setTimelineSuccess(false);
    try {
      const updates = Object.entries(stageDates).map(([stageId, dates]) => ({
        stageId,
        startsAt: dates.startsAt || null,
        endsAt: dates.endsAt || null,
      }));
      await updateEventTimelineAction(eventId, updates);
      setTimelineSuccess(true);
      setTimeout(() => setTimelineSuccess(false), 3000);
      const updated = await getEventDetailsAction(eventId);
      setEvent(updated);
    } catch (err) {
      console.error("Failed to update timeline:", err);
      alert("Error updating stage timeline");
    } finally {
      setUpdatingTimeline(false);
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
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-slate-900">Event not found</h2>
        <p className="text-slate-600 mt-2 font-medium">The event you are looking for does not exist or has been deleted.</p>
        <Link href="/events" className="mt-4 inline-block text-blue-600 hover:underline font-bold">
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
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16 select-none">
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/events">
            <Button variant="ghost" size="icon" className="mt-1 text-slate-700 hover:bg-slate-200">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{event.name}</h1>
              <Badge variant={event.status === 'ACTIVE' ? 'success' : event.status === 'DRAFT' ? 'neutral' : 'purple'} size="sm">
                {event.status}
              </Badge>
              <Badge variant="purple" size="sm">Stage: {currentStage.displayName}</Badge>
            </div>
            <p className="text-xs text-slate-600 font-mono font-medium">
              Public Link: <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">awardos.io/e/{event.slug}</a>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              <span>Public Page</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={() => setShowBulkImportModal(true)} className="bg-white border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm">
            <Upload className="w-4 h-4 mr-1.5" />
            <span>Bulk Import</span>
          </Button>
          <Link href={`/events/${eventId}/ai-cleanup`}>
            <Button variant="primary" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
              <Sparkles className="w-4 h-4 mr-1.5" />
              <span>Run AI Cleanup</span>
            </Button>
          </Link>
          <Link href={`/events/${eventId}/integrity`}>
            <Button variant="outline" size="sm" className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50 shadow-sm">
              <ShieldAlert className="w-4 h-4 mr-1.5" />
              <span>Voting Integrity</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Center Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Overview", icon: Trophy },
          { id: "categories", label: `Categories (${event.categories.length})`, icon: Layers },
          { id: "workflow", label: "Workflow & Timeline", icon: Calendar },
          { id: "branding", label: "Branding Assets", icon: ImageIcon },
          { id: "settings", label: "Event Settings", icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-2xl transition-all border-b-2 ${
                isActive
                  ? "text-blue-600 border-blue-600 bg-blue-50"
                  : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100"
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
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Categories</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{event.categories.length}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Nominations</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{event.nominationsCount}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Votes Cast</span>
                <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{event.votesCount}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Vote className="w-5 h-5" />
              </div>
            </div>
          </div>

          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Program Description & Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700 pt-4 font-medium">
              <p className="leading-relaxed text-sm">{event.description || "No description provided for this program."}</p>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                <div>
                  <span className="text-slate-500 block uppercase text-[10px] font-semibold">Start Date</span>
                  <span className="font-bold text-slate-900">{startDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block uppercase text-[10px] font-semibold">End Date</span>
                  <span className="font-bold text-slate-900">{endDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/events/${eventId}/results`}>
              <Card className="hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all h-full bg-white border-slate-200/80 rounded-3xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <CardTitle className="text-sm font-bold text-slate-900">Official Results Manager</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Audit vote tallies, manage candidate disqualifications, and publish winners leaderboard to the public portal.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/analytics`}>
              <Card className="hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all h-full bg-white border-slate-200/80 rounded-3xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-sm font-bold text-slate-900">Real-Time Analytics Hub</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Monitor voting velocity timeline charts, category turnout shares, and voter device telemetry.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/exports`}>
              <Card className="hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all h-full bg-white border-slate-200/80 rounded-3xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <CardTitle className="text-sm font-bold text-slate-900">Data Export & Reports</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Generate and download spreadsheet records (CSV) of votes, nominations, and voter credentials.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/integrity`}>
              <Card className="hover:border-blue-500/50 hover:shadow-md cursor-pointer transition-all h-full bg-white border-slate-200/80 rounded-3xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                    <CardTitle className="text-sm font-bold text-slate-900">Voting Integrity Panel</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    Monitor network IP address clusters, duplicate browser footprints, and manage audit resolutions.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      {/* Tab 2: Categories with Live Submissions Feed */}
      {activeTab === "categories" && (
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Award Categories & Live Incoming Submissions</CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                View category definitions and monitor incoming live user nominations in real time as they arrive.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/events/${eventId}/suggested-categories`}>
                <Button variant="outline" size="sm" className="bg-white border-purple-200 text-purple-700 hover:bg-purple-50 shadow-sm gap-1.5 flex items-center">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Suggested Inbox</span>
                </Button>
              </Link>
              <Button variant="primary" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
                <Plus className="w-4 h-4 mr-1" />
                <span>Add Category</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {event.categories.map((cat: any, idx: number) => {
              const isExpanded = expandedCategoryIds[cat.id];
              const incomingList = cat.incomingNominations || [];

              return (
                <div
                  key={cat.id}
                  className="rounded-3xl bg-slate-50 border border-slate-200/80 overflow-hidden space-y-0"
                >
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center border border-blue-200">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                        <p className="text-xs text-slate-600 font-medium">{cat.description || "No category description"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="purple" size="sm">{cat.count} Submissions</Badge>
                      <button
                        onClick={() => toggleCategoryExpand(cat.id)}
                        className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 hover:bg-slate-100 shadow-sm"
                      >
                        <span>{isExpanded ? "Hide Feed" : "View Live Feed"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Live Incoming Feed */}
                  {isExpanded && (
                    <div className="p-4 bg-white border-t border-slate-200/80 space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
                        <span className="flex items-center gap-1.5 text-blue-600">
                          <Users className="w-4 h-4" /> Incoming Live Submissions ({incomingList.length})
                        </span>
                        <Link href={`/events/${eventId}/ai-cleanup`}>
                          <Button variant="ghost" size="sm" className="text-xs text-purple-600 font-bold hover:bg-purple-50 h-7">
                            <Sparkles className="w-3.5 h-3.5 mr-1" /> Clean Up in AI Hub →
                          </Button>
                        </Link>
                      </div>

                      {incomingList.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs italic py-4 font-medium">
                          No incoming nominations received for this category yet. Share the public nomination link to start collecting entries!
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {incomingList.map((nom: any, nIdx: number) => (
                            <div
                              key={nom.id || nIdx}
                              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 text-xs space-y-1 font-medium"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 truncate">{nom.nomineeText}</span>
                                <Badge variant="neutral" size="sm">{nom.status || "LOGGED"}</Badge>
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono">
                                <span>Submitted</span>
                                <span>{new Date(nom.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Workflow Pipeline & Timeline Editor */}
      {activeTab === "workflow" && (
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> Event Schedule & Stage Timeline Editor
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Adjust nomination and voting window durations, set opening/closing dates, or manually activate stages.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              {timelineSuccess && (
                <span className="text-xs text-emerald-600 font-bold animate-in fade-in duration-300">
                  ✓ Timeline Updated!
                </span>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={updatingTimeline}
                onClick={handleSaveTimeline}
                className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 px-5"
              >
                {updatingTimeline ? <Loader2 className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                <span>Save Timeline Schedule</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {event.stages?.map((s: any, idx: number) => {
              const isActive = s.status === "ACTIVE";
              const isCompleted = s.status === "COMPLETED";
              const currentDates = stageDates[s.id] || { startsAt: "", endsAt: "" };

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-3xl border transition-all space-y-3 ${
                    isActive
                      ? "bg-blue-50/60 border-blue-300 shadow-sm"
                      : isCompleted
                      ? "bg-slate-50 border-slate-200 opacity-90"
                      : "bg-slate-50/60 border-slate-200/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : isCompleted
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{s.displayName}</h4>
                          <Badge
                            variant={isActive ? "success" : isCompleted ? "purple" : "neutral"}
                            size="sm"
                          >
                            {s.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono font-medium">
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
                          className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20"
                        >
                          Activate Stage Now
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
                          className="rounded-full bg-slate-200 text-slate-800 hover:bg-slate-300 font-bold text-xs"
                        >
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Datetime Pickers for Stage Schedule */}
                  {(s.stageType === "NOMINATIONS" || s.stageType === "VOTING" || s.stageType === "OFFICIAL_RESULTS") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-600" /> Start Date & Time
                        </label>
                        <input
                          type="datetime-local"
                          value={currentDates.startsAt}
                          onChange={(e) => handleStageDateChange(s.id, "startsAt", e.target.value)}
                          className="w-full bg-white text-slate-900 text-xs rounded-xl p-2 border border-slate-200 focus:outline-none font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-rose-600" /> End Date & Time (Deadline)
                        </label>
                        <input
                          type="datetime-local"
                          value={currentDates.endsAt}
                          onChange={(e) => handleStageDateChange(s.id, "endsAt", e.target.value)}
                          className="w-full bg-white text-slate-900 text-xs rounded-xl p-2 border border-slate-200 focus:outline-none font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Branding */}
      {activeTab === "branding" && (
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Branding & Assets</CardTitle>
                <CardDescription className="text-xs text-slate-600 font-medium">
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

          <CardContent className="space-y-6 max-w-2xl font-sans pt-4">
            {/* Image URLs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Logo Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Header Banner Image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/banner.png"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Colors grid */}
            <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Primary Color</label>
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
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-xl px-2 py-1.5 border border-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Secondary Color</label>
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
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-xl px-2 py-1.5 border border-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Accent Color</label>
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
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-xl px-2 py-1.5 border border-slate-200 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                disabled={updatingBranding}
                onClick={handleSaveBranding}
                className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
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
          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">Event Settings</CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium">
              Configure access visibility, verification mechanisms, and whitelists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-2xl font-sans pt-4">
            {/* Visibility Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Visibility</label>
              <select
                value={visibility}
                onChange={(e: any) => setVisibility(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="PUBLIC">Public (Visible on search and discovery)</option>
                <option value="UNLISTED">Unlisted (Accessible only via direct link)</option>
                <option value="PRIVATE">Private (Restricted access)</option>
              </select>
            </div>

            {/* Live Results Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Live Results Visibility</label>
              <select
                value={liveResultsMode}
                onChange={(e: any) => setLiveResultsMode(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
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
              <label className="text-xs font-semibold text-slate-700">Voter Authentication & Verification Method</label>
              <select
                value={verificationMethod}
                onChange={(e: any) => setVerificationMethod(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="NONE">None (Guest voting, standard tracking only)</option>
                <option value="EMAIL_OTP">Email OTP Verification (Verifies real emails via 6-digit code)</option>
                <option value="INVITATION_CODE">Invitation Code Authentication (Unique single-use code)</option>
              </select>
            </div>

            {/* Email OTP Whitelist Settings (conditional) */}
            {verificationMethod === "EMAIL_OTP" && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Whitelist Domains</label>
                  <CardDescription className="text-[10px] pb-1 font-medium text-slate-500">
                    Comma-separated list of allowed domains (e.g. <code className="text-blue-600">college.edu, company.com</code>). Leave empty to allow any domain.
                  </CardDescription>
                  <textarea
                    value={whitelistDomainsText}
                    onChange={(e) => setWhitelistDomainsText(e.target.value)}
                    placeholder="college.edu, company.com"
                    rows={2}
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2 border border-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Whitelist Emails</label>
                  <CardDescription className="text-[10px] pb-1 font-medium text-slate-500">
                    Comma-separated list of specific whitelisted emails. Leave empty to ignore.
                  </CardDescription>
                  <textarea
                    value={whitelistEmailsText}
                    onChange={(e) => setWhitelistEmailsText(e.target.value)}
                    placeholder="voter1@college.edu, voter2@college.edu"
                    rows={2}
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2 border border-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Invitation Code Admin Link (conditional) */}
            {verificationMethod === "INVITATION_CODE" && (
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs space-y-3 animate-in fade-in duration-300">
                <p className="text-blue-950 font-medium leading-relaxed">
                  Authentication requires voters to input unique, single-use invite codes. You can generate, manage, and distribute these codes in the Invitation Panel.
                </p>
                <Link href={`/events/${eventId}/invitations`}>
                  <Button variant="outline" size="sm" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">
                    Manage Invitation Codes
                  </Button>
                </Link>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="primary"
                onClick={handleSaveSettings}
                disabled={updatingSettings}
                className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
              >
                {updatingSettings ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
                ) : null}
                <span>Save Settings</span>
              </Button>
              {settingsSuccess && (
                <span className="text-xs text-emerald-600 font-bold animate-in fade-in duration-300">
                  ✓ Settings updated successfully!
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Duplication Card */}
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm mt-6">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-base font-bold text-slate-900">Duplicate Event as Template</CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium">
              Deep-copy this event configuration (categories, nominee lists, and stages) to scaffold a new event instantly. Results, votes, and guest telemetry will be reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl font-sans pt-4">
            <form onSubmit={handleDuplicateEvent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">New Event Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Next Year Excellence Awards"
                    value={dupName}
                    onChange={(e) => setDupName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">New Event Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. next-year-excellence-2027"
                    value={dupSlug}
                    onChange={(e) => setDupSlug(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-mono font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={duplicating}
                  className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
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
