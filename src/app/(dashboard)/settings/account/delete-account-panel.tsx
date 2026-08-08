"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, Lock, Ban, Loader2, CheckCircle2 } from "lucide-react";
import { requestAccountDeletionAction } from "@/actions/account";

type WorkspaceImpact = {
  workspaceId: string;
  workspaceName: string;
  role: string;
  otherMembers: number;
  disposition: "DELETE" | "LEAVE";
  eventCount: number;
  voteCount: number;
  nominationCount: number;
};

interface DeleteAccountPanelProps {
  preflight: {
    email: string;
    displayName: string;
    requiresPassword: boolean;
    confirmPhrase: string;
    graceDays: number;
    pendingDeletion: boolean;
    deletionScheduledFor: string | null;
    workspaces: WorkspaceImpact[];
    blockers: { code: string; message: string }[];
    canDelete: boolean;
  };
}

export default function DeleteAccountPanel({ preflight }: DeleteAccountPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string | null>(
    preflight.pendingDeletion ? preflight.deletionScheduledFor : null
  );
  const [isPending, startTransition] = useTransition();

  const emailMatches =
    confirmEmail.trim().toLowerCase() === preflight.email.trim().toLowerCase();
  const phraseMatches = confirmPhrase.trim() === preflight.confirmPhrase;
  const passwordReady = !preflight.requiresPassword || password.length > 0;
  const armed = emailMatches && phraseMatches && passwordReady && preflight.canDelete;

  const deleted = preflight.workspaces.filter((w) => w.disposition === "DELETE");
  const left = preflight.workspaces.filter((w) => w.disposition === "LEAVE");

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await requestAccountDeletionAction({
          confirmEmail,
          confirmPhrase,
          password: preflight.requiresPassword ? password : undefined,
          reason: reason.trim() || undefined,
        });

        if (!result.success) {
          setError(result.message);
          return;
        }

        setScheduledFor(result.scheduledFor ?? null);
        // The account is locked from here on; land on the recovery screen so the
        // undo path is the first thing the user sees.
        window.location.href = "/account/recover";
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not schedule deletion. Try again."
        );
      }
    });
  };

  if (scheduledFor) {
    return (
      <div className="rounded-3xl bg-amber-50 border border-amber-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-700" />
          <h2 className="text-sm font-bold text-amber-950">Deletion scheduled</h2>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed font-medium">
          Your account will be permanently deleted on{" "}
          <strong>{new Date(scheduledFor).toLocaleDateString()}</strong>. You can restore
          it any time before then from the recovery page.
        </p>
        <a
          href="/account/recover"
          className="inline-flex items-center h-9 px-4 rounded-full bg-amber-900 text-white text-xs font-bold hover:bg-amber-800 transition-colors"
        >
          Go to recovery page
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-rose-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-rose-50/60 border-b border-rose-200 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-600" />
        <h2 className="text-sm font-bold text-rose-950">Delete your account</h2>
      </div>

      <div className="p-6 space-y-5">
        {preflight.blockers.length > 0 && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-slate-600" />
              <p className="text-xs font-bold text-slate-900">
                Deletion is blocked until these are resolved
              </p>
            </div>
            <ul className="space-y-1.5">
              {preflight.blockers.map((blocker, i) => (
                <li key={i} className="text-xs text-slate-700 font-medium leading-relaxed">
                  {blocker.message}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500 font-medium pt-1">
              Promote another member to Owner from{" "}
              <a href="/team" className="text-blue-600 hover:underline font-semibold">
                Members
              </a>
              , or remove the other members first.
            </p>
          </div>
        )}

        {/* Impact summary — what actually disappears */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-900">What will be removed</p>

          <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-800">
                Your profile, sign-in credentials and avatar
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {preflight.email}
              </p>
            </div>

            {deleted.map((ws) => (
              <div key={ws.workspaceId} className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-800">
                  {ws.workspaceName}{" "}
                  <span className="text-rose-600 font-bold">— deleted entirely</span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  You are its only member. {ws.eventCount}{" "}
                  {ws.eventCount === 1 ? "event" : "events"}, {ws.nominationCount}{" "}
                  {ws.nominationCount === 1 ? "nomination" : "nominations"} and{" "}
                  {ws.voteCount} {ws.voteCount === 1 ? "vote" : "votes"} will be
                  destroyed.
                </p>
              </div>
            ))}

            {left.map((ws) => (
              <div key={ws.workspaceId} className="px-4 py-3">
                <p className="text-xs font-semibold text-slate-800">
                  {ws.workspaceName}{" "}
                  <span className="text-slate-500 font-bold">— you leave, it stays</span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Your {ws.role.toLowerCase().replace(/_/g, " ")} membership is removed.{" "}
                  {ws.otherMembers} other {ws.otherMembers === 1 ? "member" : "members"}{" "}
                  keep their access and the event data.
                </p>
              </div>
            ))}

            <div className="px-4 py-3 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-800">
                Activity history — kept, but anonymized
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Audit entries in shared workspaces stay as a record of what happened;
                your name and IP address are stripped from them.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Deletion takes effect after a {preflight.graceDays}-day grace period. Access is
            revoked immediately and every signed-in session is ended; you can restore the
            account at any point during those {preflight.graceDays} days. After that it is
            permanent and cannot be undone.
          </p>
        </div>

        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            disabled={!preflight.canDelete}
            className="h-10 px-5 rounded-full bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Continue to delete my account
          </button>
        ) : (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label htmlFor="confirmEmail" className="text-xs font-bold text-slate-800">
                Type your email address to confirm
              </label>
              <input
                id="confirmEmail"
                type="text"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={preflight.email}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-medium focus:outline-none focus:border-rose-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPhrase" className="text-xs font-bold text-slate-800">
                Type{" "}
                <span className="font-mono text-rose-700">{preflight.confirmPhrase}</span>{" "}
                to confirm
              </label>
              <input
                id="confirmPhrase"
                type="text"
                autoComplete="off"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder={preflight.confirmPhrase}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-mono font-medium focus:outline-none focus:border-rose-500 transition-all"
              />
            </div>

            {preflight.requiresPassword && (
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  Re-enter your password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-medium focus:outline-none focus:border-rose-500 transition-all"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-xs font-bold text-slate-800">
                Why are you leaving? <span className="font-medium text-slate-400">(optional)</span>
              </label>
              <textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-medium focus:outline-none focus:border-slate-400 transition-all resize-none"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"
              >
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={!armed || isPending}
                className="h-10 px-5 rounded-full bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                {isPending ? "Scheduling…" : "Delete my account"}
              </button>

              <button
                onClick={() => {
                  setExpanded(false);
                  setConfirmEmail("");
                  setConfirmPhrase("");
                  setPassword("");
                  setError(null);
                }}
                disabled={isPending}
                className="h-10 px-5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
