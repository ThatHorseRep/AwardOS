"use client";

import React, { useState } from "react";
import { Sparkles, Key, Cpu, Check, ShieldCheck, Zap, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AISettingsPage() {
  const [selectedProvider, setSelectedProvider] = useState<"google" | "openai" | "anthropic">("google");
  const [modelName, setModelName] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const providers = [
    {
      id: "google",
      name: "Google Gemini",
      badge: "Default & Recommended",
      models: ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
      envKey: "GEMINI_API_KEY",
      desc: "High speed, low latency, and native support for deduplication and event scripts.",
    },
    {
      id: "openai",
      name: "OpenAI GPT",
      badge: "Optional",
      models: ["gpt-4o", "gpt-4o-mini"],
      envKey: "OPENAI_API_KEY",
      desc: "Industry standard model for creative ceremony copy and complex rule evaluations.",
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      badge: "Optional",
      models: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
      envKey: "ANTHROPIC_API_KEY",
      desc: "Superior qualitative reasoning for nomination review and panel summaries.",
    },
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="purple" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Co-Pilot Engine
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">AI Settings & Provider Config</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Configure default AI models, API provider preferences, and model parameters for nomination cleanup & assistant chat.
        </p>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p) => {
          const isSelected = selectedProvider === p.id;
          return (
            <Card
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id as any);
                setModelName(p.models[0]);
              }}
              className={`cursor-pointer transition-all duration-200 border relative ${
                isSelected
                  ? "bg-purple-950/20 border-purple-500/60 shadow-lg shadow-purple-950/50"
                  : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-purple-400" />}
                </div>

                <div>
                  <h3 className="font-bold text-white text-sm">{p.name}</h3>
                  <span className="text-[10px] text-purple-400 font-medium">{p.badge}</span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">{p.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detailed Config Form */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-400" /> API Configuration & Model Selection
          </CardTitle>
          <CardDescription className="text-zinc-400 text-xs">
            Manage provider credentials and target model selection for {providers.find((p) => p.id === selectedProvider)?.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Model Version</label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            >
              {providers
                .find((p) => p.id === selectedProvider)
                ?.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">API Key Override (Optional)</label>
              <span className="text-[10px] text-zinc-500">
                Fallback: process.env.{providers.find((p) => p.id === selectedProvider)?.envKey}
              </span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to use server environment variable..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-purple-300">Enterprise Privacy Guarantee</span>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                AwardOS processes voter data through strictly sanitized AI prompts. Nomination deduplication and merge suggestions never store voter personal identity data on third-party AI provider logs.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => { setApiKey(""); setSaved(false); }} className="text-xs text-zinc-400 hover:text-white">
              Reset Defaults
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} className="bg-purple-600 hover:bg-purple-500 text-xs">
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" /> Settings Saved!
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1" /> Save AI Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
