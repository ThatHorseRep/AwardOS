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
    <div className="max-w-3xl mx-auto space-y-6 font-sans select-none pb-12">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <button className="p-2 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account &amp; Data</h1>
          <p className="text-xs text-slate-500 font-medium">
            Delete your AwardOS account and remove your personal data.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Your data on AwardOS</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          AwardOS stores your name, email address, profile photo and a record of the
          administrative actions you have taken. Voting data collected by your events —
          ballots, nominations, voter email verifications and IP records — belongs to the
          workspace that owns the event, not to your personal profile.
        </p>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          Deleting your account removes your credentials and profile, and takes any
          workspace you are the sole member of with it. Workspaces you share with other
          people stay behind, minus your membership.
        </p>
      </div>

      <DeleteAccountPanel preflight={preflight} />
    </div>
  );
}
