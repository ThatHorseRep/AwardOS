"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw, Trophy, LogOut } from "lucide-react";
import { cancelAccountDeletionAction } from "@/actions/account";
import { signOutAction } from "@/actions/auth";

interface RecoverAccountClientProps {
  status: {
    email: string;
    displayName: string;
    requestedAt: string;
    scheduledFor: string | null;
    graceDays: number;
  };
}

function daysRemaining(scheduledFor: string | null): number | null {
  if (!scheduledFor) return null;
  const diff = new Date(scheduledFor).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function RecoverAccountClient({ status }: RecoverAccountClientProps) {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = daysRemaining(status.scheduledFor);
  const scheduledLabel = status.scheduledFor
    ? new Date(status.scheduledFor).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "the end of the grace period";

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      const result = await cancelAccountDeletionAction();
      if (!result.success) {
        setError(result.message);
        setRestoring(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restore your account. Try again."
      );
      setRestoring(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutAction();
    } catch {
      // Fall through to the hard redirect below.
    }
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen w-full bg-[#f4f5f8] flex flex-col items-center justify-center p-4 font-sans">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <span className="text-2xl font-bold text-slate-900 tracking-tight">AwardOS</span>
      </div>

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-7 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          This account is scheduled for deletion
        </h1>

        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          {status.email} will be permanently deleted on{" "}
          <strong className="text-slate-900 font-semibold">{scheduledLabel}</strong>
          {remaining !== null && (
            <>
              {" "}
              &mdash;{" "}
              <strong className="text-slate-900 font-semibold">
                {remaining} {remaining === 1 ? "day" : "days"}
              </strong>{" "}
              from now
            </>
          )}
          . Until then your workspaces are locked and nothing has been erased.
        </p>

        <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
            What happens on that date
          </p>
          <ul className="mt-2.5 space-y-1.5 text-xs text-slate-600 leading-relaxed">
            <li>Your sign-in credentials are erased and cannot be recovered.</li>
            <li>Workspaces where you are the only member are deleted, along with their events, nominations and votes.</li>
            <li>Shared workspaces stay; your membership is removed.</li>
            <li>Past activity records are kept but no longer identify you.</li>
          </ul>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
          >
            {error}
          </div>
        )}

        <button
          onClick={handleRestore}
          disabled={restoring}
          className="mt-5 w-full h-11 rounded-2xl bg-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-md shadow-blue-600/20"
        >
          <RotateCcw className="w-4 h-4" />
          {restoring ? "Restoring…" : "Restore my account"}
        </button>

        <button
          onClick={handleSignOut}
          className="mt-2.5 w-full h-11 rounded-2xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out and leave it scheduled
        </button>
      </div>

      <p className="text-[11px] text-slate-500 mt-5 text-center max-w-sm leading-relaxed">
        Requested on {new Date(status.requestedAt).toLocaleDateString()}. If you did not
        request this, restore the account now and change your password.
      </p>
    </div>
  );
}
