"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trophy, ShieldCheck, AlertCircle, Loader2, ArrowRight, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getInviteDetailsAction, acceptWorkspaceInviteAction } from "@/actions/members";
type InviteDetails = Awaited<ReturnType<typeof getInviteDetailsAction>>;
type ValidInvite = NonNullable<InviteDetails["invite"]>;

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<ValidInvite | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    async function checkInvite() {
      setLoading(true); setLoadFailed(false); setErrorReason(null);
      try {
        const res = await getInviteDetailsAction(token);
        if (res.valid && res.invite) {
          setInviteData(res.invite);
        } else {
          setErrorReason(res.reason || "Invalid invitation link.");
        }
      } catch (err) {
        console.error("Error verifying invitation token:", err);
        setErrorReason("Failed to load invitation link.");
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    }
    checkInvite();
  }, [token, loadAttempt]);

  const handleAccept = () => {
    setAcceptError(null);
    startTransition(async () => {
      try {
        const res = await acceptWorkspaceInviteAction(token);
        if (res.success) {
          router.push("/dashboard");
        }
      } catch (err: unknown) {
        console.error("Accept invite error:", err);
        setAcceptError(err instanceof Error ? err.message : "Failed to accept workspace invitation.");
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 font-sans select-none">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500 mx-auto" />
          <p className="text-xs text-zinc-400 font-medium">Verifying invitation credentials...</p>
        </div>
      </div>
    );
  }

  if (errorReason || !inviteData) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 font-sans select-none">
        <Card className="max-w-md w-full bg-zinc-950/80 border-zinc-800/80 rounded-3xl text-center p-8 space-y-5 shadow-2xl backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Invitation Unavailable</h1>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {errorReason || "This workspace invitation link is invalid or has expired."}
            </p>
          </div>
          <Link href="/sign-in" className="block pt-2">
            <Button className="w-full rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs">
              Go to AwardOS Sign In
            </Button>
          </Link>
          {loadFailed && <Button variant="outline" className="w-full" onClick={() => setLoadAttempt((value) => value + 1)}>Try again</Button>}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 font-sans select-none relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-bold text-blue-400 shadow-md">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>AwardOS Workspace Invitation</span>
          </div>
        </div>

        <Card className="bg-zinc-950/90 border-zinc-800/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl p-6 md:p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-blue-600/20 ring-4 ring-zinc-900">
              <Building2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {inviteData.workspaceName}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 font-medium">
                You&apos;ve been invited to collaborate on award programs and live ballot streams.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-3 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="text-zinc-500 font-medium">Assigned Role:</span>
              <Badge variant="purple" size="sm" className="font-mono text-xs">
                {inviteData.customRoleName || inviteData.role}
              </Badge>
            </div>

            {inviteData.email && (
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500 font-medium">Target Recipient:</span>
                <span className="font-mono text-blue-400 font-medium">{inviteData.email}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-zinc-300 pt-1 border-t border-zinc-800/60">
              <span className="text-zinc-500 font-medium">Access Permission:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Full Access Granted
              </span>
            </div>
          </div>

          {acceptError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold leading-relaxed">
              {acceptError}
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleAccept}
              disabled={isPending}
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <>
                  <span>Accept Invitation & Join Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-zinc-500 font-medium">
              By joining, you agree to AwardOS Workspace Terms of Access.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
