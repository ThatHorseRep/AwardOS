"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, Lock, Ban, Loader2, CheckCircle2 } from "lucide-react";
import { requestAccountDeletionAction } from "@/actions/account";
import { Button } from "@/components/ui/button";

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
      <div className="rounded-2xl bg-warning/10 border border-warning/20 p-6 space-y-3 text-content">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-bold text-content">Deletion scheduled</h2>
        </div>
        <p className="text-xs text-content-secondary leading-relaxed font-normal">
          Your account will be permanently deleted on{" "}
          <strong className="text-content">{new Date(scheduledFor).toLocaleDateString()}</strong>. You can restore
          it any time before then from the recovery page.
        </p>
        <a
          href="/account/recover"
          className="inline-flex items-center h-9 px-4 rounded-xl bg-surface border border-border-subtle text-content text-xs font-semibold hover:bg-surface-raised transition-colors"
        >
          Go to recovery page
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface border border-destructive/20 shadow-sm overflow-hidden text-content">
      <div className="px-6 py-4 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h2 className="text-sm font-bold text-destructive">Delete your account</h2>
      </div>

      <div className="p-6 space-y-5">
        {preflight.blockers.length > 0 && (
          <div className="rounded-xl bg-surface-raised border border-border-subtle p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-content-secondary" />
              <p className="text-xs font-bold text-content">
                Deletion is blocked until these are resolved
              </p>
            </div>
            <ul className="space-y-1.5">
              {preflight.blockers.map((blocker, i) => (
                <li key={i} className="text-xs text-content-secondary font-normal leading-relaxed">
                  {blocker.message}
                </li>
              ))}
            </ul>
            <p className="text-xs text-content-secondary font-normal pt-1">
              Promote another member to Owner from{" "}
              <a href="/team" className="text-accent hover:underline font-semibold">
                Members
              </a>
              , or remove the other members first.
            </p>
          </div>
        )}

        {/* Impact summary */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-content">What will be removed</p>

          <div className="rounded-xl border border-border-subtle divide-y divide-border-subtle overflow-hidden">
            <div className="px-4 py-3 bg-surface-raised">
              <p className="text-xs font-semibold text-content">
                Your profile, sign-in credentials and avatar
              </p>
              <p className="text-xs text-content-secondary font-mono mt-0.5">
                {preflight.email}
              </p>
            </div>

            {deleted.map((ws) => (
              <div key={ws.workspaceId} className="px-4 py-3">
                <p className="text-xs font-semibold text-content">
                  {ws.workspaceName}{" "}
                  <span className="text-destructive font-bold">— deleted entirely</span>
                </p>
                <p className="text-xs text-content-secondary font-normal mt-0.5">
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
                <p className="text-xs font-semibold text-content">
                  {ws.workspaceName}{" "}
                  <span className="text-content-secondary font-medium">— you leave, it stays</span>
                </p>
                <p className="text-xs text-content-secondary font-normal mt-0.5">
                  Your {ws.role.toLowerCase().replace(/_/g, " ")} membership is removed.{" "}
                  {ws.otherMembers} other {ws.otherMembers === 1 ? "member" : "members"}{" "}
                  keep their access and the event data.
                </p>
              </div>
            ))}

            <div className="px-4 py-3 bg-surface-raised">
              <p className="text-xs font-semibold text-content">
                Activity history — kept, but anonymized
              </p>
              <p className="text-xs text-content-secondary font-normal mt-0.5">
                Audit entries in shared workspaces stay as a record of what happened;
                your name and IP address are stripped from them.
              </p>
            </div>
          </div>

          <p className="text-xs text-content-secondary font-normal leading-relaxed">
            Deletion takes effect after a {preflight.graceDays}-day grace period. Access is
            revoked immediately and every signed-in session is ended; you can restore the
            account at any point during those {preflight.graceDays} days. After that it is
            permanent and cannot be undone.
          </p>
        </div>

        {!expanded ? (
          <Button
            variant="outline"
            onClick={() => setExpanded(true)}
            disabled={!preflight.canDelete}
            className="rounded-xl font-semibold text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            <span>Continue to delete my account</span>
          </Button>
        ) : (
          <div className="space-y-4 pt-2 border-t border-border-subtle">
            <div className="space-y-1.5">
              <label htmlFor="confirmEmail" className="text-xs font-semibold text-content">
                Type your email address to confirm
              </label>
              <input
                id="confirmEmail"
                type="text"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={preflight.email}
                className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-xs text-content font-normal focus:outline-none focus:border-destructive transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPhrase" className="text-xs font-semibold text-content">
                Type{" "}
                <span className="font-mono text-destructive font-bold">{preflight.confirmPhrase}</span>{" "}
                to confirm
              </label>
              <input
                id="confirmPhrase"
                type="text"
                autoComplete="off"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder={preflight.confirmPhrase}
                className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-xs text-content font-mono font-normal focus:outline-none focus:border-destructive transition-all"
              />
            </div>

            {preflight.requiresPassword && (
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-content flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-content-secondary" />
                  Re-enter your password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-xs text-content font-normal focus:outline-none focus:border-destructive transition-all"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-xs font-semibold text-content">
                Why are you leaving? <span className="font-normal text-content-secondary">(optional)</span>
              </label>
              <textarea
                id="reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-xs text-content font-normal focus:outline-none focus:border-accent transition-all resize-none"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold"
              >
                {error}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!armed || isPending}
                className="rounded-xl font-semibold text-xs px-4"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                <span>{isPending ? "Scheduling…" : "Delete my account"}</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setExpanded(false);
                  setConfirmEmail("");
                  setConfirmPhrase("");
                  setPassword("");
                  setError(null);
                }}
                disabled={isPending}
                className="rounded-xl font-semibold text-xs px-4"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

