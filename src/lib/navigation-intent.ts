const FALLBACK_PATH = "/dashboard";

export function safeInternalPath(raw: string | null | undefined, fallback = FALLBACK_PATH): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  try {
    const parsed = new URL(raw, "https://awardos.invalid");
    if (parsed.origin !== "https://awardos.invalid") return fallback;
    if (["/sign-in", "/sign-up", "/forgot-password"].some((path) => parsed.pathname.startsWith(path))) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
