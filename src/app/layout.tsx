import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { getAppOrigin } from "@/lib/app-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppOrigin()),
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
  twitter: { card: "summary_large_image", title: "AwardOS", description: "Run nominations, voting, and results from one award operations platform." },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col font-sans bg-canvas text-content"
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-contrast focus:rounded-md focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
