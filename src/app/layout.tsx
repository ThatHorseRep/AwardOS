import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "AwardOS — The Operating System for Award Events",
    template: "%s | AwardOS",
  },
  description:
    "AI-powered platform for organizing recognition programs and award events. Manage nominations, voting, and results in one intelligent system.",
  keywords: [
    "awards",
    "recognition",
    "voting",
    "nominations",
    "award ceremony",
    "event management",
  ],
  authors: [{ name: "AwardOS" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AwardOS",
    title: "AwardOS — The Operating System for Award Events",
    description:
      "AI-powered platform for organizing recognition programs and award events.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      {/*
        Colours come from the semantic tokens in globals.css, which resolve per
        theme — the body used to hardcode a dark background while the dashboard
        shell painted itself light on top of it.
      */}
      <body
        className="min-h-full flex flex-col font-sans bg-canvas text-content"
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
