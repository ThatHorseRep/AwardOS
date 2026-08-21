export type VerificationMethod = "NONE" | "EMAIL_OTP" | "INVITATION_CODE";

/**
 * The authoritative voter-verification method is the one persisted on the
 * event's `verification_config`. UI surfaces must derive what they display
 * from this — never from `verification_level`, which is an independent badge
 * and must not silently rewrite how voters authenticate.
 */
export function storedVerificationMethod(
  verificationConfig: unknown
): VerificationMethod {
  const method = (verificationConfig as { method?: VerificationMethod } | null)
    ?.method;
  return method === "EMAIL_OTP" || method === "INVITATION_CODE"
    ? method
    : "NONE";
}
