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
  Loader2,
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

      localStorage.setItem(`awardos_nomination_${slug}`, JSON.stringify(entries));
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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12 font-sans">
        <h2 className="text-xl font-bold text-slate-900">Event not found</h2>
        <p className="text-slate-600 mt-2 font-medium">The event page you are looking for does not exist or has been deleted.</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline font-bold">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans select-none pb-16">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Link href={`/e/${slug}`}>
          <Button variant="ghost" size="sm" className="text-slate-700 hover:bg-slate-200">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back to Event</span>
          </Button>
        </Link>

        <Badge variant="purple" size="sm">
          <Sparkles className="w-3 h-3 mr-1" /> Nomination Stage Open
        </Badge>
      </div>

      {/* Header Banner */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Submit Your Nominations
        </h1>
        <p className="text-slate-600 text-xs max-w-lg mx-auto leading-relaxed font-medium">
          Honoring excellence for <strong className="text-slate-900">{event.name}</strong>. You can nominate candidates across multiple categories below. No sign-in required!
        </p>
      </div>

      {/* Already Submitted Banner */}
      {hasAlreadySubmitted && (
        <div className="p-4 rounded-3xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-3 font-medium">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>You have already submitted nominations for this event. You can submit additional entries or updates below.</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
          {error}
        </div>
      )}

      {/* Nomination Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {event.categories.map((cat: any, idx: number) => (
            <Card key={cat.id} className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <Badge variant="purple" size="sm">Category 0{idx + 1}</Badge>
                </div>
                <CardTitle className="text-base text-slate-900 font-bold mt-1.5">{cat.name}</CardTitle>
                {cat.description && (
                  <CardDescription className="text-slate-600 text-xs font-medium mt-1">
                    {cat.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Nominee Full Name or Organization *</span>
                    <span className="text-[10px] text-slate-400 font-medium">Optional if skipping category</span>
                  </label>
                  <input
                    type="text"
                    value={nominations[cat.id] || ""}
                    onChange={(e) => handleInputChange(cat.id, e.target.value)}
                    placeholder="Enter full name (e.g. Dr. Jane Doe or Student Club Name)"
                    className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Suggest New Category Box */}
        <Card className="border-purple-200 bg-purple-50/50 rounded-3xl shadow-sm">
          <CardHeader className="pb-3 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <CardTitle className="text-sm font-bold text-purple-950">Don&apos;t see the right category?</CardTitle>
            </div>
            <CardDescription className="text-xs text-purple-900 font-medium">
              Suggest a new award category to the event organizers for review.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <input
              type="text"
              value={suggestedCategory}
              onChange={(e) => setSuggestedCategory(e.target.value)}
              placeholder="e.g. Lifetime Achievement in Campus Mentorship"
              className="w-full bg-white text-slate-900 text-xs rounded-2xl px-4 py-2.5 border border-purple-200 focus:outline-none focus:border-purple-500 font-medium"
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
            className="w-full sm:w-auto rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 shadow-md shadow-blue-600/20"
          >
            {submitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            <span>Submit Nominations</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
