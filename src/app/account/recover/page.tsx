import { redirect } from "next/navigation";
import { getAccountDeletionStatusAction } from "@/actions/account";
import RecoverAccountClient from "./recover-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AwardOS — Restore Account",
};

/**
 * Landing page for an account inside its deletion grace window. The dashboard
 * layout redirects here, so this is the only surface such an account can reach.
 */
export default async function RecoverAccountPage() {
  const status = await getAccountDeletionStatusAction();

  // No pending request — either not signed in, or the account is healthy.
  if (!status) {
    redirect("/dashboard");
  }

  return <RecoverAccountClient status={status} />;
}
