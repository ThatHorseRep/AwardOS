"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  Globe,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getInviteDetailsAction, acceptWorkspaceInviteAction } from "@/actions/members";
import { getCurrentUser } from "@/actions/workspaces";

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [inviteDetails, setInviteDetails] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    async function loadInvite() {
      try {
        const [details, user] = await Promise.all([
          getInviteDetailsAction(token),
          getCurrentUser(),
        ]);

        if (!details.valid) {
          setError(details.error || "Invitation link not found or expired.");
        } else {
          setInviteDetails(details);
        }
        setCurrentUser(user);
      } catch (err: any) {
        console.error("Error loading invitation details:", err);
        setError("Failed to verify invitation token.");
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [token]);

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await acceptWorkspaceInviteAction(token);
        if (res.success) {
          setAcceptedSuccess(true);
          setTimeout(() => {
            router.push("/dashboard");
          }, 1200);
        }
      } catch (err: any) {
        console.error("Failed to accept invitation:", err);
        setError(err?.message || "Failed to accept invitation.");
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4 font-sans">
        <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-3" />
        <span className="text-xs text-zinc-400 font-medium">Verifying invitation security token...</span>
      </div>
    );
  }

  if (error || !inviteDetails?.valid) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4 font-sans select-none">
        <Card className="w-full max-w-md bg-zinc-950 border-zinc-900 rounded-3xl shadow-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight">Invitation Link Invalid</h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              {error || "This invitation token has expired, been revoked, or reached its usage limit."}
            </p>
          </div>

          <div className="pt-2">
            <Link href={currentUser ? "/dashboard" : "/sign-in"}>
              <Button variant="primary" className="w-full rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs">
                <span>{currentUser ? "Go to Workspace Dashboard" : "Sign In to AwardOS"}</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { invite, workspace } = inviteDetails;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4 font-sans select-none relative overflow-hidden">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md bg-zinc-950/90 backdrop-blur-xl border-zinc-900 rounded-3xl shadow-2xl p-6 sm:p-8 relative space-y-6">
        {/* Header Branding Icon */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-blue-600/30">
              🏆
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight block">AwardOS</span>
              <span className="text-[10px] text-zinc-500 font-medium">Workspace Access Studio</span>
            </div>
          </div>
          <Badge variant="purple" size="sm">
            INVITATION
          </Badge>
        </div>

        {/* Workspace Invite Banner */}
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Workspace Collaboration
          </div>

          <h1 className="text-2xl font-bold text-white tracking-tight">
            You've been invited to join <span className="text-blue-400">{workspace.name}</span>
          </h1>

          <p className="text-xs text-zinc-400 leading-relaxed font-medium">
            Join as <strong className="text-zinc-200">{invite.customRoleName || invite.role}</strong> to manage award programs, nominations, and live ballot workflows.
          </p>
        </div>

        {/* Account Status Box */}
        {currentUser ? (
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Signed in as:</span>
              <span className="font-bold text-white truncate max-w-[200px]">{currentUser.email}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Assigned Role:</span>
              <Badge variant="success" size="sm" className="font-mono text-[10px]">
                {invite.customRoleName || invite.role}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-center text-xs">
            <p className="text-zinc-300 font-semibold">You need an AwardOS account to join this workspace.</p>
            <p className="text-[11px] text-zinc-500">Sign in or create a free account to accept your invitation.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {acceptedSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              <span>Invitation Accepted! Redirecting to Workspace...</span>
            </div>
          ) : currentUser ? (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={handleAccept}
              className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
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
          ) : (
            <div className="space-y-2">
              <Link href={`/sign-in?redirectTo=/invite/${token}`}>
                <Button variant="primary" className="w-full py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs">
                  <span>Sign In to Accept Invitation</span>
                </Button>
              </Link>

              <Link href={`/sign-up?redirectTo=/invite/${token}`}>
                <Button variant="outline" className="w-full py-3 rounded-full border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs font-bold">
                  <span>Create Account & Join</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
