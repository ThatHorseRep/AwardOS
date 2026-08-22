"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Share2, Home, ShieldCheck, Search, Copy, Check, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyBallotReceiptAction } from "@/actions/voting";
import { ShareKitModal } from "@/components/sharing/share-kit-modal";
import { Input } from "@/components/ui/input";
type ReceiptVerification = Awaited<ReturnType<typeof verifyBallotReceiptAction>>;

export default function VotingThankYouPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Live status of THIS browser's own ballot. The receipt was true at cast
  // time; integrity review can later flag or invalidate a ballot, so the
  // badge is checked against the server instead of asserted statically.
  const [selfStatus, setSelfStatus] = useState<"CHECKING" | "COUNTED" | "UNDER_REVIEW" | "NOT_COUNTED" | "UNKNOWN">("CHECKING");

  // Public Verification Tool state
  const [searchCode, setSearchCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ReceiptVerification | null>(null);

  const eventTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  useEffect(() => {
    const stored = localStorage.getItem(`awardos_receipt_${slug}`);
    setReceiptCode(stored);
    if (!stored) return;
    verifyBallotReceiptAction(slug, stored)
      .then((res) => {
        if (res.valid) setSelfStatus("COUNTED");
        else if ((res as { state?: string }).state === "UNDER_REVIEW") setSelfStatus("UNDER_REVIEW");
        else if ((res as { state?: string }).state === "INVALIDATED") setSelfStatus("NOT_COUNTED");
        else setSelfStatus("UNKNOWN");
      })
      .catch(() => setSelfStatus("UNKNOWN"));
  }, [slug]);

  const handleCopyReceipt = () => {
    if (!receiptCode) return;
    navigator.clipboard.writeText(receiptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await verifyBallotReceiptAction(slug, searchCode.trim());
      setVerificationResult(res);
    } catch (err) {
      console.error("Failed to verify receipt:", err);
      setVerificationResult({ valid: false, message: "Verification check failed." });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main id="main-content" className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 text-center font-sans sm:px-6 sm:py-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success shadow-sm">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-content text-balance">
          Vote cast and verified
        </h1>
        <p className="mx-auto max-w-lg text-sm text-content-secondary text-pretty">
          Your ballot for <strong className="text-content">{eventTitle}</strong> has been received and recorded. Keep your receipt — you can verify its current tally status here at any time.
        </p>
      </div>

      {/* Cryptographic Receipt Card */}
      {receiptCode && (
        <Card className="rounded-2xl border-border-subtle bg-surface text-left shadow-sm">
          <CardHeader className="pb-2 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-content">
                <ShieldCheck className="h-4 w-4 text-accent" /> Ballot receipt
              </CardTitle>
              {selfStatus === "COUNTED" && (
                <Badge variant="success" size="sm">COUNTED</Badge>
              )}
              {selfStatus === "UNDER_REVIEW" && (
                <Badge variant="warning" size="sm">UNDER REVIEW</Badge>
              )}
              {selfStatus === "NOT_COUNTED" && (
                <Badge variant="danger" size="sm">NOT COUNTED</Badge>
              )}
              {selfStatus === "UNKNOWN" && (
                <Badge variant="neutral" size="sm">STATUS UNAVAILABLE</Badge>
              )}
              {selfStatus === "CHECKING" && (
                <Loader2 className="h-4 w-4 animate-spin text-content-secondary" />
              )}
            </div>
            <CardDescription className="text-xs text-content-secondary text-pretty">
              Save this receipt code. It lets you verify that your ballot remains included in the event audit tally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-raised p-3 shadow-sm">
              <code className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-content">{receiptCode}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyReceipt}
                aria-label={copied ? "Receipt copied" : "Copy receipt"}
                className="h-8 shrink-0 text-content-secondary hover:text-content"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600 font-bold" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Ballot Verification Box */}
      <Card className="rounded-2xl border-border-subtle bg-surface text-left shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-content">
            <Search className="h-4 w-4 text-accent" /> Verify a ballot receipt
          </CardTitle>
          <CardDescription className="text-xs text-content-secondary text-pretty">
            Enter a receipt code to confirm that the ballot is present in this event.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleVerify} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              required
              placeholder="Paste an AwardOS receipt token"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              aria-label="Ballot receipt code"
              className="bg-surface-raised font-mono font-medium"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={verifying}
              className="shrink-0 rounded-xl px-4 text-xs font-semibold sm:w-auto"
            >
              {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : <Search className="w-4 h-4 mr-1" />}
              <span>Verify</span>
            </Button>
          </form>

          {verificationResult && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-2 text-xs animate-in fade-in duration-200">
              {verificationResult.valid ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valid ballot found</span>
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px] font-mono font-medium">
                    <div>Event: <strong className="text-slate-900">{verificationResult.eventName}</strong></div>
                    <div>Status: <span className="text-emerald-600 font-bold">{verificationResult.status}</span></div>
                    <div>Categories Voted: <strong className="text-slate-900">{verificationResult.categoriesVoted}</strong></div>
                    <div>Submitted At: <span className="text-slate-500">{verificationResult.submittedAt ? new Date(verificationResult.submittedAt).toLocaleString() : "Not available"}</span></div>
                  </div>
                </div>
              ) : (
                <div className={(verificationResult as { state?: string }).state === "UNDER_REVIEW" ? "text-amber-600 text-xs font-bold" : "text-rose-600 text-xs font-bold"}>
                  ✕ {verificationResult.message || "No matching ballot found."}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share & Landing Page Links */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="md"
          onClick={() => setShareModalOpen(true)}
          className="w-full justify-center bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold rounded-full shadow-sm"
        >
          <Share2 className="w-4 h-4 mr-2 text-blue-600" />
          <span>Share this event</span>
        </Button>

        <Link href={`/e/${slug}`} className="block">
          <Button variant="primary" size="md" className="w-full justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
            <Home className="w-4 h-4 mr-2" />
            <span>Return to event</span>
          </Button>
        </Link>
      </div>

      <ShareKitModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        eventName={eventTitle}
        eventSlug={slug}
      />
    </main>
  );
}
