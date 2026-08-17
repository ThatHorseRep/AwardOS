import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getAccountDeletionPreflightAction } from "@/actions/account";
import DeleteAccountPanel from "./delete-account-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AwardOS — Account & Data",
};

export default async function AccountSettingsPage() {
  const preflight = await getAccountDeletionPreflightAction();

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans select-none pb-12 animate-page-entrance text-content">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <button
            aria-label="Back to settings"
            className="p-2 rounded-xl bg-surface border border-border-subtle text-content-secondary hover:text-content hover:bg-surface-raised transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-content tracking-tight">Account &amp; data</h1>
          <p className="text-xs text-content-secondary font-normal">
            Delete your AwardOS account and remove your personal data.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-border-subtle shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-content-secondary" />
          <h2 className="text-sm font-bold text-content">Your data on AwardOS</h2>
        </div>
        <p className="text-xs text-content-secondary leading-relaxed font-normal">
          AwardOS stores your name, email address, profile photo and a record of the
          administrative actions you have taken. Voting data collected by your events —
          ballots, nominations, voter email verifications and IP records — belongs to the
          workspace that owns the event, not to your personal profile.
        </p>
        <p className="text-xs text-content-secondary leading-relaxed font-normal">
          Deleting your account removes your credentials and profile, and takes any
          workspace you are the sole member of with it. Workspaces you share with other
          people stay behind, minus your membership.
        </p>
      </div>

      <DeleteAccountPanel preflight={preflight} />
    </div>
  );
}

