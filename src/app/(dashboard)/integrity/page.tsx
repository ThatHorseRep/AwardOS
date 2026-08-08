"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Trash2,
  CheckCircle2,
  Ban,
  Download,
  Filter,
  RefreshCw,
  Search,
  Activity,
  Globe,
  Sliders,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/components/ui/toast";
export default function IntegrityPage() {
  const toast = useToast();
  const [securityLevel, setSecurityLevel] = useState<"STANDARD" | "STRICT" | "ENFORCED">("STRICT");
  const [threats, setThreats] = useState([
    {
      id: "thr-1",
      ip: "192.168.1.104",
      country: "United States (VPN)",
      anomaly: "IP Cluster Surge (42 votes in 60s)",
      riskScore: 92,
      riskTier: "HIGH",
      ballotCount: 42,
      timestamp: "12 mins ago",
      status: "FLAGGED",
    },
    {
      id: "thr-2",
      ip: "10.0.4.19",
      country: "Nigeria",
      anomaly: "Headless Browser User Agent",
      riskScore: 85,
      riskTier: "HIGH",
      ballotCount: 18,
      timestamp: "25 mins ago",
      status: "FLAGGED",
    },
    {
      id: "thr-3",
      ip: "172.16.0.88",
      country: "United Kingdom",
      anomaly: "Duplicate Cookie / Storage Reset",
      riskScore: 64,
      riskTier: "MEDIUM",
      ballotCount: 5,
      timestamp: "1 hour ago",
      status: "REVIEW",
    },
  ]);

  const handlePurge = (id: string) => {
    setThreats(threats.filter((t) => t.id !== id));
    toast.success("Flagged bot ballots purged successfully from active vote tallies.");
  };

  const handleBanIP = (ip: string) => {
    toast.error(`IP address ${ip} added to global workspace ban list.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16 select-none">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            <span>Anti-Fraud & Integrity Monitoring</span>
          </h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Real-time bot detection, IP rate cluster monitoring, and automated ballot security verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm">
            <Download className="w-4 h-4 mr-1.5" />
            <span>Export Audit Log</span>
          </Button>

          <Button variant="primary" size="sm" className="rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/20">
            <RefreshCw className="w-4 h-4 mr-1.5" />
            <span>Run Security Audit Scan</span>
          </Button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Security Score</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">98.4%</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Flagged Ballots</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">65</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Banned IP Clusters</span>
            <span className="text-3xl font-extrabold text-slate-900 mt-1 block">12</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Ban className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Protection Mode</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 block">{securityLevel}</span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Security Threat Table */}
      <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600" />
              <span>Real-Time Anomaly Logs</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium">Suspicious traffic spikes and bot fingerprint detections</CardDescription>
          </div>

          <Badge variant="danger" size="sm">
            {threats.length} Flagged
          </Badge>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="divide-y divide-slate-100">
            {threats.map((thr) => (
              <div
                key={thr.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors rounded-2xl"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-mono font-bold text-slate-900">{thr.ip}</span>
                    <Badge variant={thr.riskTier === "HIGH" ? "danger" : "warning"} size="sm">
                      Risk Score: {thr.riskScore} ({thr.riskTier})
                    </Badge>
                    <span className="text-xs text-slate-500 font-medium">• {thr.country}</span>
                  </div>
                  <p className="text-xs text-rose-600 font-bold">{thr.anomaly}</p>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {thr.ballotCount} ballots generated • {thr.timestamp}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBanIP(thr.ip)}
                    className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold shadow-sm"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    <span>Ban IP</span>
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handlePurge(thr.id)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span>Purge Ballots ({thr.ballotCount})</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
