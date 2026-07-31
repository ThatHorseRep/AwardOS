"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  TrendingUp,
  ArrowLeft,
  Smartphone,
  Clock,
  Globe,
  Loader2,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Zap,
  Monitor,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventAnalyticsAction } from "@/actions/analytics";

export default function OrganizerAnalyticsDashboardPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any | null>(null);

  const loadData = async () => {
    try {
      const data = await getEventAnalyticsAction(eventId);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics payload:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-slate-300 font-sans">
        <h2 className="text-xl font-bold text-white">Analytics not available</h2>
        <Link href={`/events/${eventId}`} className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Event Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              <span>Real-Time Turnout & Telemetry Analytics</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Monitor voter turnout velocity, peak voting windows, and device operating system telemetry.
            </p>
          </div>
        </div>

        <Badge variant="purple" size="md" className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Telemetry Connected
        </Badge>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
              <span>Total Votes Scanned</span>
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{analytics.totalVotesCount}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Valid vote sessions cast</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
              <span>Peak Hourly Velocity</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{analytics.peakVelocityRate}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Peak Window: {analytics.peakHourWindow}</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
              <span>Mobile Share</span>
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{analytics.mobileShare}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Handheld device voters</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase">
              <span>Avg Completion Time</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-1.5">{analytics.avgCompletionTime}</div>
            <span className="text-[10px] text-slate-400 mt-1 block">Average checkout session</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Velocity timeline chart list */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>Hourly Vote Submission Velocity</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Hourly log of submitted voter ballots to identify traffic spikes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.velocityData.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs italic">No hourly records collected.</div>
              ) : (
                <div className="space-y-3 pt-2">
                  {analytics.velocityData.map((d: any, idx: number) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400 font-semibold">{d.hour}</span>
                        <span className="text-white font-bold">{d.votes} votes</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-900/60 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              analytics.totalVotesCount > 0 ? (d.votes / analytics.totalVotesCount) * 100 : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Turnout share & OS Breakdown */}
        <div className="space-y-6">
          {/* OS Breakdown Card */}
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-400" /> Operating System Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.osBreakdown?.map((os: any) => (
                <div key={os.name} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>{os.name}</span>
                    <span className="font-mono text-purple-400 font-bold">{os.count} ({os.percent}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-900/60 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${os.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Turnout share by category */}
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white">Turnout Share by Category</CardTitle>
              <CardDescription className="text-xs">
                Participation metrics across event divisions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics.categoryTurnout.length === 0 ? (
                <div className="text-center text-slate-500 text-xs italic py-8">No categories turnout metrics.</div>
              ) : (
                analytics.categoryTurnout.map((cat: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-200">
                      <span className="font-semibold truncate max-w-[170px]">{cat.name}</span>
                      <span className="font-bold shrink-0">{cat.votes} ({cat.percent}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-900/60 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${cat.percent}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
