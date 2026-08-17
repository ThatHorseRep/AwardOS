import type { Metadata } from "next";
export const metadata: Metadata = { title: "Submit a nomination", robots: { index: false, follow: false } };
export default function NominationLayout({ children }: { children: React.ReactNode }) { return children; }
