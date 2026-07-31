"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Trophy, CheckCircle2, Share2, ArrowRight, Sparkles, Home } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NominationConfirmationPage() {
  const params = useParams();
  const slug = params.slug as string;

  const eventTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/e/${slug}`);
    alert("Event link copied to clipboard!");
  };

  return (
    <div className="max-w-md mx-auto py-8 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Nominations Received!
        </h1>
        <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
          Thank you for participating in <strong className="text-slate-200">{eventTitle}</strong>. Your nominations have been logged for organizer review.
        </p>
      </div>

      <Card className="border-indigo-500/20 text-left">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Next Stages</span>
          </CardTitle>
          <CardDescription>
            Organizers will run AI Nomination Cleanup to filter duplicate entries before launching the public ballot.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Public Ballot Launch:</span>
            <span className="font-semibold text-indigo-300">August 2026</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="w-full justify-center"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Event Link with Colleagues</span>
          </Button>
        </CardContent>

        <CardFooter className="pt-2">
          <Link href={`/e/${slug}`} className="w-full">
            <Button variant="primary" size="md" className="w-full justify-center">
              <Home className="w-4 h-4" />
              <span>Return to Event Page</span>
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
