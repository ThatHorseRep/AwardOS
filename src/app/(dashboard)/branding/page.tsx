"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Palette,
  Sparkles,
  Check,
  Eye,
  Layout,
  Sun,
  Moon,
  Zap,
  Crown,
  Save,
  Loader2,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventsAction } from "@/actions/events";

export default function GlobalBrandingStudioPage() {
  const [loading, setLoading] = useState(true);
  const [eventList, setEventList] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const events = await getEventsAction();
        setEventList(events || []);
      } catch (err) {
        console.error("Failed to load events for branding studio:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12">
      {/* Header Bar */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Palette className="w-6 h-6 text-purple-400" />
          <span>Branding & Theme Studio</span>
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Select an event program to customize its public portal colors, theme presets, logo banners, and custom styling.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Select Event to Customize</h2>

        {eventList.length === 0 ? (
          <Card className="border-slate-800 bg-slate-950/20 p-12 text-center text-slate-400 space-y-3">
            <Calendar className="w-8 h-8 text-purple-400 mx-auto" />
            <h3 className="text-base font-bold text-white">No active events found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Create an event program first to customize its branding theme.
            </p>
            <Link href="/events/new">
              <Button variant="primary" size="sm" className="bg-purple-600 hover:bg-purple-500 text-white">
                Create Event
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {eventList.map((evt) => (
              <Card key={evt.id} className="border-slate-800 bg-slate-950/20 hover:border-purple-500/40 transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="purple" size="sm">{evt.status}</Badge>
                    <Link href={`/e/${evt.slug}`} target="_blank">
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-400 hover:text-white px-2">
                        <Eye className="w-3 h-3 mr-1" /> Preview
                      </Button>
                    </Link>
                  </div>
                  <CardTitle className="text-base text-white mt-1 group-hover:text-purple-400 transition-colors">
                    {evt.name}
                  </CardTitle>
                  {evt.description && <CardDescription className="text-xs line-clamp-2">{evt.description}</CardDescription>}
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href={`/events/${evt.id}/branding`}>
                    <Button variant="outline" size="sm" className="w-full justify-between border-slate-800 text-slate-200 hover:bg-purple-600/10 hover:border-purple-500/50">
                      <span>Customize Event Branding</span>
                      <ChevronRight className="w-4 h-4 text-purple-400" />
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
