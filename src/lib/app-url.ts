export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://awardos-alpha.vercel.app").replace(/\/$/, "");

export function getAppOrigin() {
  return typeof window !== "undefined" ? window.location.origin : APP_URL;
}

export function getFallbackHost() {
  try {
    return new URL(APP_URL).host;
  } catch {
    return APP_URL;
  }
}
