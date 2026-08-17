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
type ReceiptVerification = Awaited<ReturnType<typeof verifyBallotReceiptAction>>;

export default function VotingThankYouPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Public Verification Tool state
  const [searchCode, setSearchCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ReceiptVerification | null>(null);

  const eventTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  useEffect(() => {
    setReceiptCode(localStorage.getItem(`awardos_receipt_${slug}`));
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
    <div className="max-w-xl mx-auto py-8 text-center space-y-6 font-sans select-none pb-16">
      <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Vote cast and verified
        </h1>
        <p className="text-slate-600 text-xs leading-relaxed max-w-sm mx-auto font-medium">
          Your ballot for <strong className="text-slate-900">{eventTitle}</strong> is recorded as immutable and included in the event tally.
        </p>
      </div>

      {/* Cryptographic Receipt Card */}
      {receiptCode && (
        <Card className="border-blue-200 bg-blue-50/50 text-left rounded-3xl shadow-sm">
          <CardHeader className="pb-2 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" /> Cryptographic Ballot Receipt
              </CardTitle>
              <Badge variant="success" size="sm">COUNTED</Badge>
            </div>
            <CardDescription className="text-xs text-blue-900 font-medium">
              Save this digital receipt token. You can present it at any time to verify that your ballot was included in the final event audit tally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="p-3.5 rounded-2xl bg-white border border-blue-200 flex items-center justify-between gap-2 shadow-sm">
              <code className="text-xs font-mono text-slate-900 font-bold truncate max-w-xs">{receiptCode}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyReceipt}
                className="text-slate-600 hover:text-slate-900 shrink-0 h-8 font-medium"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600 font-bold" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Ballot Verification Box */}
      <Card className="border-slate-200/80 bg-white text-left rounded-3xl shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-600" /> Public Ballot Verification Tool
          </CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium">
            Verify any receipt token to confirm its cryptographic inclusion in the event database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleVerify} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Paste an AwardOS receipt token"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-purple-500 font-mono font-medium"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={verifying}
              className="rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shrink-0 px-4"
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
                    <span>Valid Certified Ballot Found!</span>
                  </div>
                  <div className="space-y-1 text-slate-700 text-[11px] font-mono font-medium">
                    <div>Event: <strong className="text-slate-900">{verificationResult.eventName}</strong></div>
                    <div>Status: <span className="text-emerald-600 font-bold">{verificationResult.status}</span></div>
                    <div>Categories Voted: <strong className="text-slate-900">{verificationResult.categoriesVoted}</strong></div>
                    <div>Submitted At: <span className="text-slate-500">{verificationResult.submittedAt ? new Date(verificationResult.submittedAt).toLocaleString() : "Not available"}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-rose-600 text-xs font-bold">
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
          <span>Invite Friends & Promote Candidates</span>
        </Button>

        <Link href={`/e/${slug}`} className="block">
          <Button variant="primary" size="md" className="w-full justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
            <Home className="w-4 h-4 mr-2" />
            <span>Return to Event Landing Page</span>
          </Button>
        </Link>
      </div>

      <ShareKitModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        eventName={eventTitle}
        eventSlug={slug}
      />
    </div>
  );
}
