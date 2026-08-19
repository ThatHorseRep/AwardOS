"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Trophy, ArrowLeft, Calendar, Users, Vote, Sparkles, ExternalLink, Upload, Copy as CopyIcon, Image as ImageIcon, Layers, Settings as SettingsIcon, Sliders, Plus, Trash2, Edit2, Clock, Loader2, ShieldAlert, ChevronDown, ChevronUp, Save, MessageSquare, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventDetailsAction, updateEventBrandingAction, duplicateEventAction, updateWorkflowStageStatusAction, updateEventTimelineAction, deleteEventAction } from "@/actions/events";
import { updateEventSettingsAction } from "@/actions/voting";
import { BulkImportModal } from "@/components/import/bulk-import-modal";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { createCategoryAction, updateCategoryAction, deleteCategoryAction, deactivateCategoryAction, reorderCategoriesAction } from "@/actions/categories";
import { getAppOrigin } from "@/lib/app-url";
import { LoadError } from "@/components/shared/load-error";

type EventDetails = Awaited<ReturnType<typeof getEventDetailsAction>>;
type LoadedEvent = NonNullable<EventDetails>;
type EventCategory = LoadedEvent["categories"][number];
type EventStage = LoadedEvent["stages"][number];
type EventTab = "overview" | "categories" | "workflow" | "branding" | "settings";
type LiveResultsMode = "HIDDEN" | "RANKINGS" | "PERCENTAGES" | "VOTE_COUNTS" | "FULL_LEADERBOARD";
type VerificationConfig = { method?: "NONE" | "EMAIL_OTP" | "INVITATION_CODE" };
type AudienceConfig = { whitelistDomains?: string[]; whitelistEmails?: string[] };

export default function EventDetailPage() {
  const toast = useToast();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const initialTab = (searchParams.get("tab") as "overview" | "categories" | "workflow" | "branding" | "settings") || "overview";
  const [activeTab, setActiveTab] = useState<"overview" | "categories" | "workflow" | "branding" | "settings">(initialTab);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);

  const [event, setEvent] = useState<EventDetails>(null);
  const hasLoadedEvent = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<{ [catId: string]: boolean }>({});

  // Timeline / Schedule state
  const [stageDates, setStageDates] = useState<{ [stageId: string]: { startsAt: string; endsAt: string } }>({});
  const [updatingTimeline, setUpdatingTimeline] = useState(false);
  const [timelineSuccess, setTimelineSuccess] = useState(false);

  // Settings tab form states
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PRIVATE");
  const [liveResultsMode, setLiveResultsMode] = useState<LiveResultsMode>("HIDDEN");
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

  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryEligibility, setCategoryEligibility] = useState("");
  const [categoryMaxNominees, setCategoryMaxNominees] = useState(1);
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryToRemove, setCategoryToRemove] = useState<EventCategory | null>(null);
  const [removingCategory, setRemovingCategory] = useState(false);
  const [reorderingCategory, setReorderingCategory] = useState<string | null>(null);

  async function moveCategory(categoryId: string, direction: -1 | 1) {
    if (!event) return;
    const index = event.categories.findIndex((category: { id: string }) => category.id === categoryId);
    const target = index + direction;
    if (target < 0 || target >= event.categories.length) return;
    const ids = event.categories.map((category: { id: string }) => category.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setReorderingCategory(categoryId);
    try { await reorderCategoriesAction(eventId, ids); setLoadAttempt((value) => value + 1); }
    catch (error) { toast.error(error instanceof Error ? error.message : "We could not reorder these categories."); setReorderingCategory(null); }
  }
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [confirmPublishedDelete, setConfirmPublishedDelete] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  async function handleDeleteEvent() {
    if (!event) return;
    setDeletingEvent(true);
    try {
      await deleteEventAction(eventId, deleteConfirmation, confirmPublishedDelete);
      toast.success("Event moved to deleted events and can be restored for 30 days.");
      router.push("/events/deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "We could not delete this event."); }
    finally { setDeletingEvent(false); }
  }

  function openCategoryEditor(category?: EventCategory) {
    setEditingCategory(category ?? null);
    setCategoryName(category?.name ?? "");
    setCategoryDescription(category?.description ?? "");
    setCategoryEligibility(category?.eligibility ?? "");
    setCategoryMaxNominees(category?.maxNomineesPerVoter ?? 1);
    setCategoryEditorOpen(true);
  }

  async function handleSaveCategory(event: React.FormEvent) {
    event.preventDefault();
    setSavingCategory(true);
    try {
      const input = {
        name: categoryName,
        description: categoryDescription,
        eligibility: categoryEligibility,
        maxNomineesPerVoter: categoryMaxNominees,
      };
      if (editingCategory) {
        await updateCategoryAction(eventId, editingCategory.id, input);
        toast.success("Category updated.");
      } else {
        await createCategoryAction(eventId, input);
        toast.success("Category created.");
      }
      setCategoryEditorOpen(false);
      setLoadAttempt((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not save this category.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleRemoveCategory(deactivate: boolean) {
    if (!categoryToRemove) return;
    setRemovingCategory(true);
    try {
      if (deactivate) {
        await deactivateCategoryAction(eventId, categoryToRemove.id);
        toast.success("Category deactivated.");
      } else {
        await deleteCategoryAction(eventId, categoryToRemove.id);
        toast.success("Category deleted.");
      }
      setCategoryToRemove(null);
      setLoadAttempt((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not remove this category.");
    } finally {
      setRemovingCategory(false);
    }
  }

  useEffect(() => {
    async function loadData() {
      if (!hasLoadedEvent.current) setLoading(true);
      setLoadError(false);
      try {
        const data = await getEventDetailsAction(eventId);
        setEvent(data);
        hasLoadedEvent.current = Boolean(data);
        if (data) {
          setVisibility(data.visibility || "PRIVATE");
          setLiveResultsMode(data.liveResultsMode || "HIDDEN");
          setVerificationMethod((data.verificationConfig as VerificationConfig | null)?.method || "NONE");
          setWhitelistDomainsText((data.audienceConfig as AudienceConfig | null)?.whitelistDomains?.join(", ") || "");
          setWhitelistEmailsText((data.audienceConfig as AudienceConfig | null)?.whitelistEmails?.join(", ") || "");
          
          // Load branding values
          setLogoUrl(data.branding?.logoUrl || "");
          setBannerUrl(data.branding?.bannerUrl || "");
          setPrimaryColor(data.branding?.primaryColor || "#2563eb");
          setSecondaryColor(data.branding?.secondaryColor || "#1d4ed8");
          setAccentColor(data.branding?.accentColor || "#f59e0b");

          // Load timeline stage dates
          if (data.stages) {
            const datesMap: Record<string, { startsAt: string; endsAt: string }> = {};
            data.stages.forEach((s: EventStage) => {
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
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [eventId, loadAttempt]);

  useEffect(() => {
    const tab = searchParams.get("tab") as "overview" | "categories" | "workflow" | "branding" | "settings" | null;
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams, activeTab]);

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
      toast.error("Error updating stage timeline");
    } finally {
      setUpdatingTimeline(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }

  if (loadError) return <LoadError message="We could not load this event workspace." onRetry={() => setLoadAttempt((value) => value + 1)} />;

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-content">Event not found</h2>
        <p className="text-content-secondary mt-2 font-normal">The event you are looking for does not exist or has been deleted.</p>
        <Link href="/events" className="mt-4 inline-block text-accent hover:underline font-semibold text-xs">
          Back to events →
        </Link>
      </div>
    );
  }

  if (!event) return null;
  const currentStage = event.stages?.find((s) => s.status === 'ACTIVE') || event.stages?.find((s) => s.status === 'PENDING') || { displayName: 'Draft' };
  const nominationStage = event.stages?.find((s) => s.stageType === 'NOMINATIONS');
  const votingStage = event.stages?.find((s) => s.stageType === 'VOTING');
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
      toast.error("Error saving settings");
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
      toast.error("Error saving branding assets settings.");
    } finally {
      setUpdatingBranding(false);
    }
  };

  const handleDuplicateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupName.trim() || !dupSlug.trim()) {
      toast.error("Please enter a name and unique URL slug for the duplicated event.");
      return;
    }
    setDuplicating(true);
    try {
      const cloned = await duplicateEventAction(eventId, dupName.trim(), dupSlug.trim().toLowerCase());
      toast.success(`Event duplicated successfully! Redirecting to new event draft...`);
      router.push(`/events/${cloned.id}`);
    } catch (err: unknown) {
      console.error("Duplication error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to duplicate event.");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16 select-none animate-page-entrance text-content">
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/events">
            <Button variant="ghost" size="icon" aria-label="Back to events" className="mt-1 text-content-secondary hover:text-content">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-content tracking-tight">{event.name}</h1>
              <Badge variant={event.status === 'ACTIVE' ? 'success' : event.status === 'DRAFT' ? 'neutral' : 'default'} size="sm">
                {event.status.toLowerCase()}
              </Badge>
              <Badge variant="default" size="sm">Stage: {currentStage.displayName}</Badge>
            </div>
            <p className="text-xs text-content-secondary font-mono font-medium">
              Public link: <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer" className="text-accent hover:underline font-semibold">{getAppOrigin()}/e/{event.slug}</a>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a href={`/e/${event.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              <span>Public page</span>
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={() => setShowBulkImportModal(true)} className="rounded-xl text-xs font-semibold">
            <Upload className="w-4 h-4 mr-1.5" />
            <span>Bulk import</span>
          </Button>
          <Link href={`/events/${eventId}/nominations`}>
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
              <Users className="w-4 h-4 mr-1.5" />
              <span>Review nominations</span>
            </Button>
          </Link>
          <Link href={`/events/${eventId}/ai-cleanup`}>
            <Button variant="primary" size="sm" className="rounded-xl font-semibold text-xs">
              <Sparkles className="w-4 h-4 mr-1.5" />
              <span>AI cleanup</span>
            </Button>
          </Link>
          <Link href={`/events/${eventId}/integrity`}>
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold">
              <ShieldAlert className="w-4 h-4 mr-1.5" />
              <span>Integrity</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Control Center Tab Bar */}
      <div className="flex items-center gap-2 border-b border-border-subtle overflow-x-auto pb-1">
        {[
          { id: "overview", label: "Overview", icon: Trophy },
          { id: "categories", label: `Categories (${event.categories.length})`, icon: Layers },
          { id: "workflow", label: "Workflow & timeline", icon: Calendar },
          { id: "branding", label: "Branding assets", icon: ImageIcon },
          { id: "settings", label: "Event settings", icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as EventTab);
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", tab.id);
                router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
                isActive
                  ? "text-accent border-accent bg-accent/10"
                  : "text-content-secondary border-transparent hover:text-content hover:bg-surface-raised"
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
            <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
              <div>
                <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Total categories</span>
                <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{event.categories.length}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
              <div>
                <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Total nominations</span>
                <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{event.nominationsCount}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <Link href={`/events/${eventId}/analytics`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="bg-surface rounded-2xl p-5 border border-border-subtle shadow-sm flex items-center justify-between text-content hover-lift">
              <div>
                <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider block">Ballots submitted</span>
                <span className="text-3xl font-bold text-content mt-1 block tabular-nums">{event.voteAccounting.submittedBallots}</span>
                <span className="text-[11px] text-accent font-semibold mt-1 block">View voting activity</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-border-subtle text-accent flex items-center justify-center font-bold">
                <Vote className="w-5 h-5" />
              </div>
            </div>
            </Link>
          </div>

          <Card className="border-border-subtle bg-surface-raised rounded-2xl shadow-sm px-5 py-5 text-content">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-content">Continue the admin workflow</p>
                <p className="text-xs text-content-secondary mt-1 max-w-xl font-normal">
                  Review nominees before opening the voting ballot, or inspect this event&apos;s voting activity and ballot controls once the roster is ready.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <Link href={`/events/${eventId}/nominations`}>
                  <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs">
                    <MessageSquare className="w-4 h-4 mr-1.5" />
                    <span>Review nominees</span>
                  </Button>
                </Link>
                <Link href={`/events/${eventId}/analytics`}>
                  <Button variant="primary" size="sm" className="rounded-xl font-semibold text-xs">
                    <Vote className="w-4 h-4 mr-1.5" />
                    <span>View voting activity</span>
                  </Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base font-bold text-content">Program description & schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-content pt-4 font-normal">
              <p className="leading-relaxed text-sm">{event.description || "No description provided for this program."}</p>
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-surface-raised border border-border-subtle">
                <div>
                  <span className="text-content-secondary block uppercase text-xs font-semibold">Start date</span>
                  <span className="font-bold text-content">{startDate}</span>
                </div>
                <div>
                  <span className="text-content-secondary block uppercase text-xs font-semibold">End date</span>
                  <span className="font-bold text-content">{endDate}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/events/${eventId}/results`}>
              <Card className="hover-lift cursor-pointer h-full bg-surface border-border-subtle rounded-2xl text-content">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-accent" />
                    <CardTitle className="text-sm font-bold text-content">Official results manager</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-content-secondary leading-relaxed font-normal">
                    Audit vote tallies, manage candidate disqualifications, and publish winners leaderboard to the public portal.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/analytics`}>
              <Card className="hover-lift cursor-pointer h-full bg-surface border-border-subtle rounded-2xl text-content">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-accent" />
                    <CardTitle className="text-sm font-bold text-content">Voting activity & analytics</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-content-secondary leading-relaxed font-normal">
                    See submitted ballots, turnout by category, voting velocity, and integrity signals for this event.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/exports`}>
              <Card className="hover-lift cursor-pointer h-full bg-surface border-border-subtle rounded-2xl text-content">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-accent" />
                    <CardTitle className="text-sm font-bold text-content">Data export & reports</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-content-secondary leading-relaxed font-normal">
                    Generate and download spreadsheet records (CSV) of votes, nominations, and voter credentials.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href={`/events/${eventId}/integrity`}>
              <Card className="hover-lift cursor-pointer h-full bg-surface border-border-subtle rounded-2xl text-content">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                    <CardTitle className="text-sm font-bold text-content">Voting integrity panel</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-content-secondary leading-relaxed font-normal">
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
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border-subtle pb-4">
            <div>
              <CardTitle className="text-base font-bold text-content">Award categories & incoming submissions</CardTitle>
              <CardDescription className="text-xs text-content-secondary font-normal">
                View category definitions and monitor incoming live user nominations in real time as they arrive.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2.5">
              <Link href={`/events/${eventId}/suggested-categories`}>
                <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold gap-1.5 flex items-center">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Suggested inbox</span>
                </Button>
              </Link>
              <Button type="button" variant="primary" size="sm" onClick={() => openCategoryEditor()} className="rounded-xl font-semibold text-xs">
                <Plus className="w-4 h-4 mr-1" />
                <span>Add category</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {event.categories.map((cat, idx: number) => {
              const isExpanded = expandedCategoryIds[cat.id];
              const incomingList = cat.incomingNominations || [];

              return (
                <div
                  key={cat.id}
                  className="rounded-2xl bg-surface-raised border border-border-subtle overflow-hidden space-y-0"
                >
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-surface text-content text-xs font-bold flex items-center justify-center border border-border-subtle">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-content">{cat.name}</h4>
                        <p className="text-xs text-content-secondary font-normal">{cat.description || "No category description"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {!cat.isActive && <Badge variant="neutral" size="sm">Inactive</Badge>}
                      <Badge variant="default" size="sm">{cat.count} submissions</Badge>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${cat.name} up`} disabled={idx === 0 || reorderingCategory !== null} onClick={() => void moveCategory(cat.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${cat.name} down`} disabled={idx === event.categories.length - 1 || reorderingCategory !== null} onClick={() => void moveCategory(cat.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${cat.name}`} onClick={() => openCategoryEditor(cat)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${cat.name}`} onClick={() => setCategoryToRemove(cat)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <button
                        onClick={() => toggleCategoryExpand(cat.id)}
                        className="px-3 py-1.5 rounded-xl bg-surface border border-border-subtle text-content text-xs font-semibold flex items-center gap-1 hover:bg-surface-raised shadow-sm"
                      >
                        <span>{isExpanded ? "Hide feed" : "View live feed"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Live Incoming Feed */}
                  {isExpanded && (
                    <div className="p-4 bg-surface border-t border-border-subtle space-y-3 animate-page-entrance">
                      <div className="flex items-center justify-between text-xs font-bold text-content border-b border-border-subtle pb-2">
                        <span className="flex items-center gap-1.5 text-accent">
                          <Users className="w-4 h-4" /> Incoming live submissions ({incomingList.length})
                        </span>
                        <Link href={`/events/${eventId}/ai-cleanup`}>
                          <Button variant="ghost" size="sm" className="text-xs text-accent font-semibold h-7">
                            <Sparkles className="w-3.5 h-3.5 mr-1" /> Clean up in AI hub →
                          </Button>
                        </Link>
                      </div>

                      {incomingList.length === 0 ? (
                        <div className="text-center text-content-secondary text-xs italic py-4 font-normal">
                          No incoming nominations received for this category yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {incomingList.map((nom, nIdx: number) => (
                            <div
                              key={nom.id || nIdx}
                              className="p-3 rounded-xl bg-surface-raised border border-border-subtle text-xs space-y-1 font-normal"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-content truncate">{nom.nomineeText}</span>
                                <Badge variant="neutral" size="sm">{nom.isLatest ? "LATEST" : "HISTORICAL"}</Badge>
                              </div>
                              <div className="text-xs text-content-secondary flex items-center justify-between font-mono">
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
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-content flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" /> Event schedule & stage timeline editor
              </CardTitle>
              <CardDescription className="text-xs text-content-secondary font-normal">
                Adjust nomination and voting window durations, set opening/closing dates, or manually activate stages.
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              {timelineSuccess && (
                <span className="text-xs text-success font-semibold animate-page-entrance">
                  ✓ Timeline updated
                </span>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={updatingTimeline}
                onClick={handleSaveTimeline}
                className="rounded-xl font-semibold text-xs px-4"
              >
                {updatingTimeline ? <Loader2 className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                <span>Save timeline</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {event.stages?.map((s, idx: number) => {
              const isActive = s.status === "ACTIVE";
              const isCompleted = s.status === "COMPLETED";
              const currentDates = stageDates[s.id] || { startsAt: "", endsAt: "" };

              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isActive
                      ? "bg-accent/10 border-accent/30 shadow-sm"
                      : isCompleted
                      ? "bg-surface-raised border-border-subtle"
                      : "bg-surface-raised border-border-subtle opacity-80"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
                          isActive
                            ? "bg-accent text-accent-contrast"
                            : isCompleted
                            ? "bg-success/20 text-success border border-success/30"
                            : "bg-surface border border-border-subtle text-content"
                        }`}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-content text-sm">{s.displayName}</h4>
                          <Badge
                            variant={isActive ? "success" : isCompleted ? "default" : "neutral"}
                            size="sm"
                          >
                            {s.status.toLowerCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-content-secondary mt-0.5 font-mono font-normal">
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
                            setLoadAttempt((value) => value + 1);
                          }}
                          className="rounded-xl font-semibold text-xs"
                        >
                          Activate stage now
                        </Button>
                      )}
                      {isActive && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            await updateWorkflowStageStatusAction(eventId, s.id, "COMPLETED");
                            setLoadAttempt((value) => value + 1);
                          }}
                          className="rounded-xl font-semibold text-xs"
                        >
                          Mark completed
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Datetime Pickers for Stage Schedule */}
                  {(s.stageType === "NOMINATIONS" || s.stageType === "VOTING" || s.stageType === "OFFICIAL_RESULTS") && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-content flex items-center gap-1">
                          <Clock className="w-3 h-3 text-accent" /> Start date & time
                        </label>
                        <input
                          type="datetime-local"
                          value={currentDates.startsAt}
                          onChange={(e) => handleStageDateChange(s.id, "startsAt", e.target.value)}
                          className="w-full bg-surface text-content text-xs rounded-xl p-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-content flex items-center gap-1">
                          <Clock className="w-3 h-3 text-destructive" /> End date & time (deadline)
                        </label>
                        <input
                          type="datetime-local"
                          value={currentDates.endsAt}
                          onChange={(e) => handleStageDateChange(s.id, "endsAt", e.target.value)}
                          className="w-full bg-surface text-content text-xs rounded-xl p-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
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
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-content">Branding & assets</CardTitle>
                <CardDescription className="text-xs text-content-secondary font-normal">
                  Configure logos, banner imagery, and theme palette.
                </CardDescription>
              </div>
              {brandingSuccess && (
                <Badge variant="success" size="sm">
                  ✓ Branding saved
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 max-w-2xl font-sans pt-4">
            {/* Image URLs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Logo image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Header banner image URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/banner.png"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                />
              </div>
            </div>

            {/* Colors grid */}
            <div className="grid grid-cols-3 gap-4 border-t border-border-subtle pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Primary color</label>
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
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-2 py-1 border border-border-subtle focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Secondary color</label>
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
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-2 py-1 border border-border-subtle focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content">Accent color</label>
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
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-2 py-1 border border-border-subtle focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-border-subtle pt-4 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                disabled={updatingBranding}
                onClick={handleSaveBranding}
                className="rounded-xl font-semibold text-xs px-4"
              >
                {updatingBranding ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                <span>Save branding</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Event Settings */}
      {activeTab === "settings" && (
        <>
          <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <CardTitle className="text-base font-bold text-content">Event settings</CardTitle>
            <CardDescription className="text-xs text-content-secondary font-normal">
              Configure access visibility, verification mechanisms, and whitelists.
            </CardDescription>
            <Link href={`/events/${eventId}/archive`} className="text-xs font-semibold text-accent hover:underline">Configure public archive</Link>
          </CardHeader>
          <CardContent className="space-y-6 max-w-2xl font-sans pt-4">
            {/* Visibility Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content">Visibility</label>
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

            {/* Live Results Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content">Live results visibility</label>
              <select
                value={liveResultsMode}
                onChange={(e) => setLiveResultsMode(e.target.value as LiveResultsMode)}
                className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
              >
                <option value="HIDDEN">Hidden (Only organizers can see live results)</option>
                <option value="RANKINGS">Rankings only (Position without votes count)</option>
                <option value="PERCENTAGES">Percentages (Vote distribution percentage)</option>
                <option value="VOTE_COUNTS">Vote counts (Raw counts only)</option>
                <option value="FULL_LEADERBOARD">Full leaderboard (Complete list with counts)</option>
              </select>
            </div>

            {/* Verification Method Settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content">Voter authentication & verification method</label>
              <select
                value={verificationMethod}
                onChange={(e) => setVerificationMethod(e.target.value as typeof verificationMethod)}
                className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
              >
                <option value="NONE">None (Guest voting, standard tracking only)</option>
                <option value="EMAIL_OTP">Email OTP verification (Verifies real emails via 6-digit code)</option>
                <option value="INVITATION_CODE">Invitation code authentication (Unique single-use code)</option>
              </select>
            </div>

            {/* Email OTP Whitelist Settings (conditional) */}
            {verificationMethod === "EMAIL_OTP" && (
              <div className="space-y-4 pt-2 border-t border-border-subtle animate-page-entrance">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Whitelist domains</label>
                  <CardDescription className="text-xs pb-1 font-normal text-content-secondary">
                    Comma-separated list of allowed domains (e.g. <code className="text-accent">college.edu, company.com</code>). Leave empty to allow any domain.
                  </CardDescription>
                  <textarea
                    value={whitelistDomainsText}
                    onChange={(e) => setWhitelistDomainsText(e.target.value)}
                    placeholder="college.edu, company.com"
                    rows={2}
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">Whitelist emails</label>
                  <CardDescription className="text-xs pb-1 font-normal text-content-secondary">
                    Comma-separated list of specific whitelisted emails. Leave empty to ignore.
                  </CardDescription>
                  <textarea
                    value={whitelistEmailsText}
                    onChange={(e) => setWhitelistEmailsText(e.target.value)}
                    placeholder="voter1@college.edu, voter2@college.edu"
                    rows={2}
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>
            )}

            {/* Invitation Code Admin Link (conditional) */}
            {verificationMethod === "INVITATION_CODE" && (
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-xs space-y-3 animate-page-entrance">
                <p className="text-content font-normal leading-relaxed">
                  Authentication requires voters to input unique, single-use invite codes. You can generate, manage, and distribute these codes in the invitation panel.
                </p>
                <Link href={`/events/${eventId}/invitations`}>
                  <Button variant="outline" size="sm" className="rounded-xl font-semibold text-xs">
                    Manage invitation codes
                  </Button>
                </Link>
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
              <Button
                variant="primary"
                onClick={handleSaveSettings}
                disabled={updatingSettings}
                className="rounded-xl font-semibold text-xs px-4"
              >
                {updatingSettings ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-1.5" />
                ) : null}
                <span>Save settings</span>
              </Button>
              {settingsSuccess && (
                <span className="text-xs text-success font-semibold animate-page-entrance">
                  ✓ Settings updated
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Duplication Card */}
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm mt-6 text-content">
          <CardHeader className="border-b border-border-subtle pb-4">
            <CardTitle className="text-base font-bold text-content">Duplicate event as template</CardTitle>
            <CardDescription className="text-xs text-content-secondary font-normal">
              Deep-copy this event configuration (categories, nominee lists, and stages) to scaffold a new event instantly. Results and votes will be reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl font-sans pt-4">
            <form onSubmit={handleDuplicateEvent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">New event name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Next Year Excellence Awards"
                    value={dupName}
                    onChange={(e) => setDupName(e.target.value)}
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content">New event slug</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. next-year-excellence-2027"
                    value={dupSlug}
                    onChange={(e) => setDupSlug(e.target.value)}
                    className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-mono font-normal"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={duplicating}
                  className="rounded-xl font-semibold text-xs px-4"
                >
                  {duplicating ? (
                    <Loader2 className="animate-spin w-4 h-4 mr-2" />
                  ) : (
                    <CopyIcon className="w-4 h-4 mr-2" />
                  )}
                  <span>Clone event draft</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 border-danger/40 bg-surface text-content">
          <CardHeader><CardTitle className="text-base">Danger zone</CardTitle><CardDescription>Remove this event from lists and public routes. It remains recoverable for 30 days.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-content-secondary">Ballots, nominations, results, and audit context stay intact during recovery.</p><Button variant="danger" onClick={() => { setDeleteConfirmation(""); setConfirmPublishedDelete(false); setDeleteEventOpen(true); }}><Trash2 className="mr-2 size-4" />Delete event</Button></CardContent>
        </Card>
        </>
      )}

      <BulkImportModal
        eventId={eventId}
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          setShowBulkImportModal(false);
          setLoadAttempt((value) => value + 1);
        }}
      />

      <Modal
        open={categoryEditorOpen}
        onClose={() => !savingCategory && setCategoryEditorOpen(false)}
        title={editingCategory ? "Edit category" : "Add category"}
        description="Categories define the sections participants nominate and vote in."
        size="md"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="category-name" className="text-sm font-semibold text-content">Category name</label>
            <input id="category-name" required minLength={2} maxLength={150} value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content focus:border-accent focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="category-description" className="text-sm font-semibold text-content">Description</label>
            <textarea id="category-description" maxLength={1000} rows={3} value={categoryDescription} onChange={(e) => setCategoryDescription(e.target.value)} className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content focus:border-accent focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="category-eligibility" className="text-sm font-semibold text-content">Eligibility rules</label>
            <textarea id="category-eligibility" maxLength={1000} rows={3} value={categoryEligibility} onChange={(e) => setCategoryEligibility(e.target.value)} className="w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content focus:border-accent focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="category-max-nominees" className="text-sm font-semibold text-content">Maximum selections per voter</label>
            <input id="category-max-nominees" type="number" min={1} max={10} value={categoryMaxNominees} onChange={(e) => setCategoryMaxNominees(Number(e.target.value))} className="min-h-11 w-full rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-content focus:border-accent focus:outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCategoryEditorOpen(false)} disabled={savingCategory}>Cancel</Button>
            <Button type="submit" isLoading={savingCategory}>{editingCategory ? "Save category" : "Create category"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteEventOpen}
        onClose={() => !deletingEvent && setDeleteEventOpen(false)}
        title="Delete event"
        description="This event will immediately disappear from public and organizer views. You can restore it for 30 days."
        size="sm"
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteEventOpen(false)}>Cancel</Button><Button variant="danger" isLoading={deletingEvent} disabled={deleteConfirmation !== event?.name} onClick={() => void handleDeleteEvent()}>Delete event</Button></div>}
      >
        <div className="space-y-4"><label className="block text-sm font-medium">Enter <strong>{event?.name}</strong> to confirm<input value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="mt-2 w-full rounded-lg border border-border-subtle bg-surface px-3 py-2" /></label>{(event?.status === "ACTIVE" || event?.status === "COMPLETED" || Number(event?.voteAccounting.submittedBallots) > 0) && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmPublishedDelete} onChange={(e) => setConfirmPublishedDelete(e.target.checked)} className="mt-1" /><span>I understand this published or voted event will be removed from public access.</span></label>}</div>
      </Modal>

      <Modal
        open={Boolean(categoryToRemove)}
        onClose={() => !removingCategory && setCategoryToRemove(null)}
        title="Remove category"
        description={categoryToRemove ? `Choose how to remove ${categoryToRemove.name} from this event.` : undefined}
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-content-secondary">Delete is available only when the category has no nominations, nominees, or ballots. Deactivate preserves existing records and removes the category from future public forms.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setCategoryToRemove(null)} disabled={removingCategory}>Cancel</Button>
            <Button type="button" variant="outline" onClick={() => handleRemoveCategory(true)} disabled={removingCategory}>Deactivate</Button>
            <Button type="button" variant="danger" onClick={() => handleRemoveCategory(false)} isLoading={removingCategory}>Delete permanently</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
