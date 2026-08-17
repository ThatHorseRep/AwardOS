import type { Metadata } from "next";
export const metadata: Metadata = { title: "Vote", robots: { index: false, follow: false } };
export default function VoteLayout({ children }: { children: React.ReactNode }) { return children; }
