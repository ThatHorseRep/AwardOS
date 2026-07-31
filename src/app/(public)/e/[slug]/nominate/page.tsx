"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  ArrowLeft,
  Users,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Send,
  Info,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPublicEventDetailsAction } from "@/actions/events";

export default function PublicNominationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [hasAlreadySubmitted, setHasAlreadySubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // State for form inputs per category
  const [nominations, setNominations] = useState<{ [catId: string]: string }>({});
  const [suggestedCategory, setSuggestedCategory] = useState("");

  // Check localStorage for previous submission and load dynamic event details
  useEffect(() => {
    const previous = localStorage.getItem(`awardos_nomination_${slug}`);
    if (previous) {
      setHasAlreadySubmitted(true);
    }

    async function loadData() {
      try {
        const data = await getPublicEventDetailsAction(slug);
        setEvent(data);
      } catch (err) {
        console.error("Failed to load event details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  const handleInputChange = (catId: string, value: string) => {
    setNominations((prev) => ({ ...prev, [catId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Convert nominations map into array of filled entries
    const entries = Object.entries(nominations)
      .filter(([_, value]) => value.trim().length > 0)
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
      // Get or create session ID
      let sessionId = localStorage.getItem("awardos_session_id");
      if (!sessionId) {
        sessionId = `sess_${Math.random().toString(36).substring(2)}_${Date.now()}`;
        localStorage.setItem("awardos_session_id", sessionId);
      }

      const response = await fetch(`/api/public/events/${slug}/nominations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominations: entries,
          suggestedCategory: suggestedCategory.trim(),
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit nomination");
      }

      // Mark local storage persistence
      localStorage.setItem(`awardos_nomination_${slug}`, JSON.stringify(entries));

      // Redirect to confirmation screen
      router.push(`/e/${slug}/nominate/confirmation`);
    } catch (err: any) {
      setError(err?.message || "An error occurred while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 text-slate-300">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <p className="text-zinc-500 mt-2">The event page you are looking for does not exist or has been deleted.</p>
        <Link href="/" className="mt-4 inline-block text-indigo-400 hover:underline">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Event</span>
          </Button>
        </Link>

        <Badge variant="purple" size="sm">
          <Sparkles className="w-3 h-3" /> Nomination Stage Open
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Submit Your Nominations
        </h1>
        <p className="text-slate-400 text-xs max-w-lg mx-auto leading-relaxed">
          Honoring excellence for <strong className="text-slate-200">{event.name}</strong>. You can nominate candidates across multiple categories below. No sign-in required!
        </p>
      </div>

      {/* Already Submitted Banner */}
      {hasAlreadySubmitted && (
        <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>You have already submitted nominations for this event. You can submit additional entries or updates below.</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Nomination Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {event.categories.map((cat: any, idx: number) => (
            <Card key={cat.id} className="border-indigo-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="default" size="sm">Category 0{idx + 1}</Badge>
                </div>
                <CardTitle className="text-base text-slate-100">{cat.name}</CardTitle>
                {cat.description && (
                  <CardDescription className="text-slate-400 text-xs">
                    {cat.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Nominee Full Name or Organization *</span>
                    <span className="text-[10px] text-slate-500 font-normal">Optional if skipping category</span>
                  </label>
                  <input
                    type="text"
                    value={nominations[cat.id] || ""}
                    onChange={(e) => handleInputChange(cat.id, e.target.value)}
                    placeholder="Enter full name (e.g. Dr. Jane Doe or Student Club Name)"
                    className="w-full bg-slate-900/80 text-slate-200 text-xs rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Suggest New Category Box */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-slate-900/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <CardTitle className="text-sm">Don&apos;t see the right category?</CardTitle>
            </div>
            <CardDescription>
              Suggest a new award category to the event organizers for review.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <input
              type="text"
              value={suggestedCategory}
              onChange={(e) => setSuggestedCategory(e.target.value)}
              placeholder="e.g. Lifetime Achievement in Campus Mentorship"
              className="w-full bg-slate-900/80 text-slate-200 text-xs rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-purple-500/60"
            />
          </CardContent>
        </Card>

        {/* Submit Action */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={submitting}
            className="w-full sm:w-auto shadow-xl shadow-indigo-600/25"
          >
            <Send className="w-4 h-4" />
            <span>Submit Nominations</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
