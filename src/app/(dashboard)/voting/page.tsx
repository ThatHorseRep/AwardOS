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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  const activeEvents = eventList.filter((e) => e.status === "ACTIVE" || e.status === "VOTING");

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Vote className="w-6 h-6 text-indigo-400" />
            <span>Voting & Ballot Control Center</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Monitor live voter turnout, configure rate limit grace windows, and preview voter ballots across your workspace.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {eventList.length > 0 && (
            <Link href={`/e/${eventList[0].slug}/vote`} target="_blank">
              <Button variant="primary" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                <span>Open Public Ballot</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Total Workspace Events</span>
              <Calendar className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{eventList.length}</div>
            <span className="text-[10px] text-slate-500 font-medium">Configured programs</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Voting Sessions</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{activeEvents.length}</div>
            <span className="text-[10px] text-emerald-400 font-medium">Live ballot access</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Security Method</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">MULTI-METHOD</div>
            <span className="text-[10px] text-purple-400 font-medium">Email OTP & Invitation PINs</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Fraud Protection</span>
              <ShieldCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">ACTIVE</div>
            <span className="text-[10px] text-slate-500 font-medium">IP + Fingerprint + Velocity</span>
          </CardContent>
        </Card>
      </div>

      {/* Active Voting Programs */}
      <Card className="border-slate-800 bg-slate-950/20">
        <CardHeader>
          <CardTitle className="text-base font-bold text-white">Configured Voting Programs</CardTitle>
          <CardDescription className="text-xs">Live balloting status and turnout breakdown per event.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {eventList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs italic">
              No event programs created yet.
            </div>
          ) : (
            eventList.map((ev) => (
              <div
                key={ev.id}
                className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{ev.name}</h4>
                    <Badge variant={ev.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                      {ev.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Visibility: <strong className="text-slate-300">{ev.visibility}</strong></span>
                    <span>•</span>
                    <span>Verification: <strong className="text-slate-300">{ev.verificationLevel}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link href={`/e/${ev.slug}/vote`} target="_blank">
                    <Button variant="outline" size="sm" className="border-slate-800 text-slate-200 hover:bg-slate-800">
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>View Public Ballot</span>
                    </Button>
                  </Link>
                  <Link href={`/events/${ev.id}`}>
                    <Button variant="secondary" size="sm">
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
