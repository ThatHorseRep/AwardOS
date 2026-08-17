import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventBranding, events } from "@/lib/db/schema";
import { getAppOrigin } from "@/lib/app-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [record] = await db.select({ name: events.name, description: events.description, visibility: events.visibility, ogImageUrl: eventBranding.ogImageUrl }).from(events).leftJoin(eventBranding, eq(eventBranding.eventId, events.id)).where(and(eq(events.slug, slug), isNull(events.deletedAt))).limit(1);
  if (!record || record.visibility === "PRIVATE") return { title: "Event not found", robots: { index: false, follow: false } };
  const description = record.description?.trim() || `View nominations, voting, and results for ${record.name}.`;
  const canonical = `${getAppOrigin()}/e/${slug}`;
  const images = record.ogImageUrl ? [{ url: record.ogImageUrl, alt: `${record.name} event preview` }] : undefined;
  return { title: record.name, description, alternates: { canonical }, robots: { index: false, follow: false }, openGraph: { type: "website", url: canonical, title: record.name, description, images }, twitter: { card: images ? "summary_large_image" : "summary", title: record.name, description, images } };
}

export default async function EventPublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [record] = await db.select({ primaryColor: eventBranding.primaryColor, secondaryColor: eventBranding.secondaryColor, accentColor: eventBranding.accentColor }).from(events).leftJoin(eventBranding, eq(eventBranding.eventId, events.id)).where(and(eq(events.slug, slug), isNull(events.deletedAt))).limit(1);
  const style = {
    ...(record?.primaryColor ? { "--event-primary": record.primaryColor } : {}),
    ...(record?.secondaryColor ? { "--event-secondary": record.secondaryColor } : {}),
    ...(record?.accentColor ? { "--color-accent": record.accentColor, "--color-accent-hover": record.accentColor } : {}),
  } as React.CSSProperties;
  return <div style={style}>{children}</div>;
}
