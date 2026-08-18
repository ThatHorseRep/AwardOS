"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Send, Info, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPublicEventDetailsAction } from "@/actions/events";
import { LoadError } from "@/components/shared/load-error";
import { evaluateWorkflowWindow } from "@/lib/workflow/policy";
import { Input } from "@/components/ui/input";

type PublicEvent = Awaited<ReturnType<typeof getPublicEventDetailsAction>>;

export default function PublicNominationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [hasAlreadySubmitted, setHasAlreadySubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [event, setEvent] = useState<PublicEvent>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // State for form inputs per category
  const [nominations, setNominations] = useState<{ [catId: string]: string }>({});
  const [suggestedCategory, setSuggestedCategory] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try { setEvent(await getPublicEventDetailsAction(slug)); }
    catch (err) { console.error("Failed to load event details:", err); setLoadError(true); }
    finally { setLoading(false); }
  }, [slug]);

  // Check localStorage for previous submission and load dynamic event details
  useEffect(() => {
    const previous = localStorage.getItem(`awardos_nomination_${slug}`);
    if (previous) {
      setHasAlreadySubmitted(true);
    }

    void loadData();
  }, [slug, loadData]);

  const handleInputChange = (catId: string, value: string) => {
    setNominations((prev) => ({ ...prev, [catId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Convert nominations map into array of filled entries
    const entries = Object.entries(nominations)
      .filter(([, value]) => value.trim().length > 0)
      .map(([categoryId, nomineeText]) => ({
        categoryId,
        nomineeText: nomineeText.trim(),
      }));

    if (entries.length === 0 && !suggestedCategory.trim()) {
      setError("Please fill in at least one nominee name or suggest a new category.");
      return;
    }

    setSubmitting(true);

    try {
      let sessionId = localStorage.getItem("awardos_session_id");
      if (!sessionId) {
        sessionId = `sess_${crypto.randomUUID()}`;
        localStorage.setItem("awardos_session_id", sessionId);
      }

      const response = await fetch(`/api/public/events/${slug}/nominations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominations: entries,
          suggestedCategory: suggestedCategory.trim(),
          sessionId,
          nominationStartToken: event?.nominationStartToken ?? undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit nomination");
      }

      localStorage.setItem(`awardos_nomination_${slug}`, JSON.stringify(entries));
      router.push(`/e/${slug}/nominate/confirmation`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-live="polite" aria-label="Loading nomination form">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" aria-hidden="true" />
      </div>
    );
  }

  if (loadError) return <LoadError message="We could not load the nomination form." onRetry={() => void loadData()} />;

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

  const nominationStage = event?.stages?.find((s) => s.stageType === "NOMINATIONS");
  const isNominationActive = evaluateWorkflowWindow({ eventStatus: event.status, stage: nominationStage, now: new Date() }).allowed;

  if (!isNominationActive) {
    return (
      <Card className="border-border-subtle bg-surface rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm font-sans select-none my-12 text-content">
        <CardHeader>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-500/20">
            <Info className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-content">Nomination period closed</CardTitle>
          <CardDescription className="text-xs text-content-secondary font-medium mt-1">
            Nominations are not currently active for {event?.name || "this event"}. Please check the event schedule for updates.
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-20 font-sans">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm" className="text-content-secondary hover:text-content">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back to event</span>
          </Button>
        </Link>

        <Badge variant="default" size="sm">
          <Sparkles className="w-3 h-3 mr-1 text-accent" /> Nomination stage open
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-content tracking-tight">
          Submit your nominations
        </h1>
        <p className="text-content-secondary text-xs max-w-lg mx-auto leading-relaxed font-normal">
          Honoring excellence for <strong className="text-content font-bold">{event.name}</strong>. You can nominate candidates across multiple categories below.
        </p>
      </div>

      {/* Already Submitted Banner */}
      {hasAlreadySubmitted && (
        <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 text-accent text-xs flex items-center justify-between gap-3 font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
            <span>You have already submitted nominations for this event. You can submit additional entries or updates below.</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Nomination Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {event.categories.map((cat, idx: number) => (
            <Card key={cat.id} className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
              <CardHeader className="pb-3 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <Badge variant="default" size="sm">Category 0{idx + 1}</Badge>
                </div>
                <CardTitle className="text-base text-content font-bold mt-1.5">{cat.name}</CardTitle>
                {cat.description && (
                  <CardDescription className="text-content-secondary text-xs font-normal mt-1">
                    {cat.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-4">
                <div className="space-y-1.5">
                  <label htmlFor={`nominee-${cat.id}`} className="text-xs font-semibold text-content flex items-center justify-between">
                    <span>Nominee full name or organization</span>
                    <span className="text-xs text-content-secondary font-normal">Optional</span>
                  </label>
                  <Input
                    id={`nominee-${cat.id}`}
                    name={`nominee-${cat.id}`}
                    type="text"
                    value={nominations[cat.id] || ""}
                    onChange={(e) => handleInputChange(cat.id, e.target.value)}
                    placeholder="Enter full name (e.g. Dr. Jane Doe or Student Club Name)"
                    className="bg-surface-raised font-normal"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Suggest New Category Box */}
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader className="pb-3 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <CardTitle className="text-sm font-bold text-content">Don&apos;t see the right category?</CardTitle>
            </div>
            <CardDescription className="text-xs text-content-secondary font-normal">
              Suggest a new award category to the event organizers for review.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <label htmlFor="suggested-category" className="mb-1.5 block text-xs font-semibold text-content">Suggested category name</label>
            <Input
              id="suggested-category"
              name="suggestedCategory"
              type="text"
              value={suggestedCategory}
              onChange={(e) => setSuggestedCategory(e.target.value)}
              placeholder="e.g. Lifetime Achievement in Campus Mentorship"
              className="bg-surface-raised font-normal"
            />
          </CardContent>
        </Card>

        {/* Submit Action */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitting}
            className="w-full sm:w-auto rounded-xl font-semibold text-xs px-6 py-2.5 shadow-sm"
          >
            {submitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            <span>Submit nominations</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
