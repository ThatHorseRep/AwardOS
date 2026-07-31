"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Share2,
  Home,
  Lock,
  ShieldCheck,
  Search,
  Copy,
  Check,
  Loader2,
  QrCode,
  FileText,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyBallotReceiptAction } from "@/actions/voting";

export default function VotingThankYouPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Public Verification Tool state
  const [searchCode, setSearchCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);

  const eventTitle = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  useEffect(() => {
    const saved = localStorage.getItem("awardos_session_id");
    if (saved) {
      setReceiptCode(`ballot-${saved}`);
    }
  }, []);

  const handleCopyReceipt = () => {
    if (!receiptCode) return;
    navigator.clipboard.writeText(receiptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/e/${slug}/vote`);
    alert("Voting link copied to clipboard!");
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
    <div className="max-w-xl mx-auto py-8 text-center space-y-6 font-sans pb-16">
      <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Vote Cast & Verified!
        </h1>
        <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
          Your ballot for <strong className="text-slate-200">{eventTitle}</strong> has been encrypted, write-locked, and permanently counted in the official database.
        </p>
      </div>

      {/* Cryptographic Receipt Card */}
      {receiptCode && (
        <Card className="border-indigo-500/30 bg-indigo-950/20 text-left">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Cryptographic Ballot Receipt
              </CardTitle>
              <Badge variant="success" size="sm">COUNTED</Badge>
            </div>
            <CardDescription className="text-xs">
              Save this digital receipt token. You can present it at any time to verify that your ballot was included in the final event audit tally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-white truncate max-w-xs">{receiptCode}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyReceipt}
                className="text-slate-400 hover:text-white shrink-0 h-8"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Public Ballot Verification Box */}
      <Card className="border-slate-800 bg-slate-950/20 text-left">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" /> Public Ballot Verification Tool
          </CardTitle>
          <CardDescription className="text-xs">
            Verify any receipt token to confirm its cryptographic inclusion in the event database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleVerify} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Paste receipt token (e.g. ballot-sess_...)"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 border border-slate-800 focus:outline-none focus:border-purple-500 font-mono"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={verifying}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs shrink-0"
            >
              {verifying ? <Loader2 className="animate-spin w-4 h-4 mr-1" /> : <Search className="w-4 h-4 mr-1" />}
              <span>Verify</span>
            </Button>
          </form>

          {verificationResult && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs animate-in fade-in duration-200">
              {verificationResult.valid ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valid Certified Ballot Found!</span>
                  </div>
                  <div className="space-y-1 text-slate-300 text-[11px] font-mono">
                    <div>Event: <strong className="text-white">{verificationResult.eventName}</strong></div>
                    <div>Status: <span className="text-emerald-400 font-bold">{verificationResult.status}</span></div>
                    <div>Categories Voted: <strong className="text-white">{verificationResult.categoriesVoted}</strong></div>
                    <div>Submitted At: <span className="text-slate-400">{new Date(verificationResult.submittedAt).toLocaleString()}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-rose-400 text-xs font-semibold">
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
          onClick={handleCopyLink}
          className="w-full justify-center border-slate-800 text-slate-200 hover:bg-slate-900"
        >
          <Share2 className="w-4 h-4 mr-2" />
          <span>Invite Friends & Colleagues to Vote</span>
        </Button>

        <Link href={`/e/${slug}`} className="block">
          <Button variant="primary" size="md" className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 text-white">
            <Home className="w-4 h-4 mr-2" />
            <span>Return to Event Landing Page</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
