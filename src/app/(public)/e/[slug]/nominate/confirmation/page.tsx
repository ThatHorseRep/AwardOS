"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Share2, Sparkles, Home } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShareKitModal } from "@/components/sharing/share-kit-modal";

export default function NominationConfirmationPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const eventTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="max-w-md mx-auto py-8 text-center space-y-6 font-sans select-none pb-16">
      <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Nominations Received!
        </h1>
        <p className="text-slate-600 text-xs leading-relaxed max-w-sm mx-auto font-medium">
          Thank you for participating in <strong className="text-slate-900">{eventTitle}</strong>. Your nominations have been logged for organizer review.
        </p>
      </div>

      <Card className="border-slate-200/80 bg-white rounded-3xl text-left shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Next Stages</span>
          </CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium">
            Organizers will run AI Nomination Cleanup to filter duplicate entries before launching the public ballot.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs font-medium">
            <span className="text-slate-600">Status:</span>
            <span className="font-bold text-blue-600">Nomination Roster Logged</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShareModalOpen(true)}
            className="w-full justify-center bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold shadow-sm rounded-full"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            <span>Share & Promote Event with Colleagues</span>
          </Button>
        </CardContent>

        <CardFooter className="pt-2">
          <Link href={`/e/${slug}`} className="w-full">
            <Button variant="primary" size="md" className="w-full justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
              <Home className="w-4 h-4 mr-1.5" />
              <span>Return to Event Page</span>
            </Button>
          </Link>
        </CardFooter>
      </Card>

      <ShareKitModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        eventName={eventTitle}
        eventSlug={slug}
      />
    </div>
  );
}
