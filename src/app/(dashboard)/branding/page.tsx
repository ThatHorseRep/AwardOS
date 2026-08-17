"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Palette, Eye, Loader2, Calendar, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventsAction } from "@/actions/events";
import { LoadError } from "@/components/shared/load-error";

export default function GlobalBrandingStudioPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [eventList, setEventList] = useState<Awaited<ReturnType<typeof getEventsAction>>>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true); setLoadError(false);
      try {
        const events = await getEventsAction();
        setEventList(events || []);
      } catch (err) {
        console.error("Failed to load events for branding studio:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [loadAttempt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }
  if (loadError) return <LoadError onRetry={() => setLoadAttempt((value) => value + 1)} />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans select-none pb-16 animate-page-entrance text-content">
      {/* Header Bar */}
      <div>
        <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
          <Palette className="w-6 h-6 text-accent" />
          <span>Branding & theme studio</span>
        </h1>
        <p className="text-content-secondary text-xs mt-1 font-normal">
          Select an event program to customize its public portal colors, theme presets, logo banners, and custom styling.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-content-secondary uppercase tracking-wider">Select event to customize</h2>

        {eventList.length === 0 ? (
          <Card className="border-border-subtle bg-surface rounded-2xl p-12 text-center text-content-secondary space-y-3 shadow-sm font-normal">
            <Calendar className="w-8 h-8 text-accent mx-auto" />
            <h3 className="text-base font-bold text-content">No active events found</h3>
            <p className="text-xs text-content-secondary max-w-md mx-auto">
              Create an event program first to customize its branding theme.
            </p>
            <Link href="/events/new">
              <Button variant="primary" size="sm" className="rounded-xl font-semibold text-xs px-6">
                Create event
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventList.map((evt) => (
              <Card key={evt.id} className="border-border-subtle bg-surface rounded-2xl hover:border-accent hover-lift transition-all group shadow-sm text-content">
                <CardHeader className="pb-3 border-b border-border-subtle">
                  <div className="flex items-center justify-between">
                    <Badge variant={evt.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                      {evt.status.toLowerCase()}
                    </Badge>
                    <Link href={`/e/${evt.slug}`} target="_blank">
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-content-secondary hover:text-content px-2 font-normal rounded-xl">
                        <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="text-base text-content font-bold mt-1 group-hover:text-accent transition-colors">
                    {evt.name}
                  </CardTitle>
                  {evt.description && <CardDescription className="text-xs text-content-secondary line-clamp-2 font-normal">{evt.description}</CardDescription>}
                </CardHeader>
                <CardContent className="pt-4">
                  <Link href={`/events/${evt.id}/branding`}>
                    <Button variant="outline" size="sm" className="w-full justify-between rounded-xl font-semibold text-xs">
                      <span>Customize event branding</span>
                      <ChevronRight className="w-4 h-4 text-accent" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
