"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Vote,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sliders,
  TrendingUp,
  Loader2,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventsAction } from "@/actions/events";

export default function OrganizerVotingPage() {
  const [loading, setLoading] = useState(true);
  const [eventList, setEventList] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const events = await getEventsAction();
        setEventList(events || []);
      } catch (err) {
        console.error("Failed to load voting dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const activeEvents = eventList.filter((e) => e.status === "ACTIVE" || e.status === "VOTING");

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Vote className="w-6 h-6 text-blue-600" />
            <span>Voting & Ballot Control Center</span>
          </h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Monitor live voter turnout, configure rate limit grace windows, and preview voter ballots across your workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {eventList.length > 0 && (
            <Link href={`/e/${eventList[0].slug}/vote`} target="_blank">
              <Button variant="primary" size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                <span>Open Public Ballot</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Programs</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{eventList.length}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Active Sessions</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">{activeEvents.length}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Security Method</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">MULTI-METHOD</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Fraud Protection</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">ACTIVE</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active Voting Programs */}
      <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">Configured Voting Programs</CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium">Live balloting status and turnout breakdown per event.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {eventList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic font-medium">
              No event programs created yet.
            </div>
          ) : (
            eventList.map((ev) => (
              <div
                key={ev.id}
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/60 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{ev.name}</h4>
                    <Badge variant={ev.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                      {ev.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                    <span>Visibility: <strong className="text-slate-900">{ev.visibility}</strong></span>
                    <span>•</span>
                    <span>Verification: <strong className="text-slate-900">{ev.verificationLevel}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link href={`/e/${ev.slug}/vote`} target="_blank">
                    <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>View Public Ballot</span>
                    </Button>
                  </Link>
                  <Link href={`/events/${ev.id}`}>
                    <Button variant="secondary" size="sm" className="bg-slate-200 text-slate-800 hover:bg-slate-300 font-semibold">
                      <Sliders className="w-3.5 h-3.5 mr-1" />
                      <span>Ballot Settings</span>
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
