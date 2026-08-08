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
      envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
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
    <div className="space-y-6 max-w-4xl mx-auto font-sans pb-16 select-none">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="purple" className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Co-Pilot Engine
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Settings & Provider Config</h1>
        <p className="text-slate-600 text-xs mt-1 font-medium">
          Configure default AI models, API provider preferences, and model parameters for nomination cleanup & assistant chat.
        </p>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p) => {
          const isSelected = selectedProvider === p.id;
          return (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id as any);
                setModelName(p.models[0]);
              }}
              className={`cursor-pointer transition-all duration-200 border rounded-3xl p-5 space-y-3 ${
                isSelected
                  ? "bg-blue-50 border-blue-400 shadow-sm"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Cpu className="w-5 h-5" />
                </div>
                {isSelected && <Check className="w-4 h-4 text-blue-600 font-bold" />}
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                <span className="text-[10px] text-blue-600 font-bold">{p.badge}</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed font-medium">{p.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Detailed Config Form */}
      <Card className="bg-white border-slate-200/80 rounded-3xl shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" /> API Configuration & Model Selection
          </CardTitle>
          <CardDescription className="text-slate-600 text-xs font-medium">
            Manage provider credentials and target model selection for {providers.find((p) => p.id === selectedProvider)?.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Model Version</label>
            <select
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500 font-medium"
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">API Key Override (Optional)</label>
              <span className="text-[10px] text-slate-500 font-medium">
                Fallback: process.env.{providers.find((p) => p.id === selectedProvider)?.envKey}
              </span>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty to use server environment variable..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-mono font-medium"
            />
          </div>

          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-blue-950">Enterprise Privacy Guarantee</span>
              <p className="text-blue-900 text-[11px] leading-relaxed font-medium">
                AwardOS processes voter data through strictly sanitized AI prompts. Nomination deduplication and merge suggestions never store voter personal identity data on third-party AI provider logs.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <Button variant="ghost" size="sm" onClick={() => { setApiKey(""); setSaved(false); }} className="text-xs text-slate-600 hover:text-slate-900 font-medium">
              Reset Defaults
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20 text-xs">
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
