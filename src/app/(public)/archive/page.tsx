import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { archiveConfigs, events } from "@/lib/db/schema";

export default async function PublicArchiveIndexPage() {
  const rows = await db.select({ slug: events.slug, name: events.name, description: events.description }).from(archiveConfigs).innerJoin(events, eq(events.id, archiveConfigs.eventId)).where(and(eq(archiveConfigs.isPublic, true), isNull(events.deletedAt))).orderBy(desc(events.updatedAt));
  return <main className="mx-auto max-w-5xl space-y-8 px-6 py-12"><header><h1 className="text-4xl font-bold text-content">Award archive</h1><p className="mt-2 text-content-secondary">Past programs published by their organizers.</p></header>{rows.length === 0 ? <p className="text-sm text-content-secondary">No public archives have been published.</p> : <div className="grid gap-4 sm:grid-cols-2">{rows.map((row) => <Link key={row.slug} href={`/archive/${row.slug}`} className="rounded-xl border border-border-subtle bg-surface p-5 transition hover:border-accent"><h2 className="text-lg font-semibold text-content">{row.name}</h2>{row.description && <p className="mt-2 text-sm text-content-secondary">{row.description}</p>}</Link>)}</div>}</main>;
}
