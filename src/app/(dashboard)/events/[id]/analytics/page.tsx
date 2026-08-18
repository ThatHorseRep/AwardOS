"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TrendingUp, ArrowLeft, Smartphone, Clock, Loader2, ArrowUpRight, BarChart3, Calendar, Zap, Monitor } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEventAnalyticsAction } from "@/actions/analytics";
import { LoadError } from "@/components/shared/load-error";

type EventAnalytics = Awaited<ReturnType<typeof getEventAnalyticsAction>>;

export default function OrganizerAnalyticsDashboardPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const data = await getEventAnalyticsAction(eventId);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics payload:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loadError) return <LoadError onRetry={() => void loadData()} />;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 text-slate-600 font-sans">
        <h2 className="text-xl font-bold text-slate-900">Analytics not available</h2>
        <Link href={`/events/${eventId}`} className="mt-4 inline-block text-blue-600 hover:underline font-bold">
          Back to Event Overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans select-none pb-16">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" aria-label="Back to event" className="mt-1 text-slate-700 hover:bg-slate-200">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <span>Real-Time Turnout & Telemetry Analytics</span>
            </h1>
            <p className="text-slate-600 text-xs mt-1 font-medium">
              Monitor voter turnout velocity, peak voting windows, and device operating system telemetry.
            </p>
          </div>
        </div>

        <Badge variant="purple" size="md" className="flex items-center gap-1.5 font-bold">
          <Zap className="w-3.5 h-3.5 text-emerald-600 animate-pulse" /> Live Telemetry Connected
        </Badge>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Submitted Ballots</span>
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5">{analytics.submittedBallots}</div>
            <span className="text-[10px] text-slate-500 mt-1 block font-medium">Valid submitted ballot sessions</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Peak Hourly Velocity</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5">{analytics.peakVelocityRate}</div>
            <span className="text-[10px] text-slate-500 mt-1 block font-medium">Peak Window: {analytics.peakHourWindow}</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Mobile Share</span>
              <Smartphone className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5">{analytics.mobileShare}</div>
            <span className="text-[10px] text-slate-500 mt-1 block font-medium">Handheld device voters</span>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Avg Completion Time</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1.5">{analytics.avgCompletionTime}</div>
            <span className="text-[10px] text-slate-500 mt-1 block font-medium">Average checkout session</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Velocity timeline chart list */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Hourly Vote Submission Velocity</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Hourly log of submitted voter ballots to identify traffic spikes.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {analytics.velocityData.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs italic font-medium">No hourly records collected.</div>
              ) : (
                <div className="space-y-3 pt-2">
                  {analytics.velocityData.map((d, idx: number) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-600 font-semibold">{d.hour}</span>
                        <span className="text-slate-900 font-bold">{d.votes} votes</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{
                            width: `${
                              analytics.submittedBallots > 0 ? (d.votes / analytics.submittedBallots) * 100 : 0
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
          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-purple-600" /> Operating System Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {analytics.osBreakdown?.map((os) => (
                <div key={os.name} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-700 font-medium">
                    <span>{os.name}</span>
                    <span className="font-mono text-purple-600 font-bold">{os.count} ({os.percent}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-purple-600 rounded-full transition-all duration-500"
                      style={{ width: `${os.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Turnout share by category */}
          <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-bold text-slate-900">Turnout Share by Category</CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Participation metrics across event divisions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {analytics.categoryTurnout.length === 0 ? (
                <div className="text-center text-slate-500 text-xs italic py-8 font-medium">No categories turnout metrics.</div>
              ) : (
                analytics.categoryTurnout.map((cat, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-900 font-medium">
                      <span className="font-semibold truncate max-w-[170px]">{cat.name}</span>
                      <span className="font-bold shrink-0">{cat.responses} ({cat.percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
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
