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

export default function IntegrityPage() {
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
    alert("Flagged bot ballots purged successfully from active vote tallies.");
  };

  const handleBanIP = (ip: string) => {
    alert(`IP address ${ip} added to global workspace ban list.`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            <span>Anti-Fraud & Integrity Monitoring</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Real-time bot detection, IP rate cluster monitoring, and automated ballot security verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
            <span>Export Audit Log</span>
          </Button>

          <Button variant="primary" size="sm" className="bg-rose-600 hover:bg-rose-500 border-rose-400/30">
            <RefreshCw className="w-4 h-4" />
            <span>Run Security Audit Scan</span>
          </Button>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Overall Security Score</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">98.4%</div>
            <span className="text-[10px] text-emerald-400 font-medium">Clean Voting Environment</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Flagged Anomaly Ballots</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">65</div>
            <span className="text-[10px] text-rose-400 font-medium">Pending organizer action</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Banned IP Clusters</span>
              <Ban className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">12</div>
            <span className="text-[10px] text-slate-500 font-medium">Active firewall blocks</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Protection Mode</span>
              <Lock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-white mt-2">{securityLevel}</div>
            <span className="text-[10px] text-indigo-400 font-medium">Device + IP + Cookie Fingerprint</span>
          </CardContent>
        </Card>
      </div>

      {/* Security Threat Table */}
      <Card className="border-rose-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <span>Real-Time Anomaly Logs</span>
            </CardTitle>
            <CardDescription>Suspicious traffic spikes and bot fingerprint detections</CardDescription>
          </div>

          <Badge variant="danger" size="sm">
            {threats.length} Flagged
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="divide-y divide-slate-800/80">
            {threats.map((thr) => (
              <div
                key={thr.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/40 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-mono font-bold text-white">{thr.ip}</span>
                    <Badge variant={thr.riskTier === "HIGH" ? "danger" : "warning"} size="sm">
                      Risk Score: {thr.riskScore} ({thr.riskTier})
                    </Badge>
                    <span className="text-xs text-slate-400">• {thr.country}</span>
                  </div>
                  <p className="text-xs text-rose-300 font-medium">{thr.anomaly}</p>
                  <span className="text-[11px] text-slate-500">
                    {thr.ballotCount} ballots generated • {thr.timestamp}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBanIP(thr.ip)}
                    className="border-slate-700 hover:border-amber-500/50"
                  >
                    <Ban className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ban IP</span>
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handlePurge(thr.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
