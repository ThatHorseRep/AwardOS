"use client";

import React, { useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Code,
  ExternalLink,
  X,
  Trophy,
  Award,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Custom SVG Social Icons
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedinIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...props}>
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7.5v-3H10V9.5C10 7.01 11.49 5.65 13.75 5.65c1.08 0 2.2.19 2.2.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 3h-2.33v6.8c4.56-.93 8-4.96 8-9.8z" />
  </svg>
);

interface ShareKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  eventSlug: string;
  nomineeName?: string;
  categoryName?: string;
  nomineeId?: string;
}

export function ShareKitModal({
  isOpen,
  onClose,
  eventName,
  eventSlug,
  nomineeName,
  categoryName,
  nomineeId,
}: ShareKitModalProps) {
  const [activeTab, setActiveTab] = useState<"social" | "embed">("social");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  if (!isOpen) return null;

  const targetUrl = typeof window !== "undefined"
    ? `${window.location.origin}/e/${eventSlug}${nomineeId ? `?candidate=${nomineeId}` : ""}`
    : `https://awardos-alpha.vercel.app/e/${eventSlug}`;

  const embedUrl = typeof window !== "undefined"
    ? `${window.location.origin}/embed/nominee/${nomineeId || "sample"}`
    : `https://awardos-alpha.vercel.app/embed/nominee/${nomineeId || "sample"}`;

  const embedSnippet = `<iframe src="${embedUrl}" width="320" height="140" frameborder="0" style="border-radius: 16px; overflow: hidden;" title="Vote for ${nomineeName || eventName} on AwardOS"></iframe>`;

  const shareTitle = nomineeName
    ? `I just voted for ${nomineeName} in ${categoryName || "the awards"} on AwardOS! 🏆`
    : `Check out ${eventName} on AwardOS! 🏆`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2500);
  };

  const socialLinks = [
    {
      name: "X (Twitter)",
      icon: TwitterIcon,
      color: "bg-slate-900 text-white hover:bg-slate-800",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(targetUrl)}`,
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-emerald-600 text-white hover:bg-emerald-500",
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle} ${targetUrl}`)}`,
    },
    {
      name: "LinkedIn",
      icon: LinkedinIcon,
      color: "bg-blue-700 text-white hover:bg-blue-600",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(targetUrl)}`,
    },
    {
      name: "Facebook",
      icon: FacebookIcon,
      color: "bg-blue-600 text-white hover:bg-blue-500",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none font-sans">
      <Card className="w-full max-w-lg bg-white border-slate-200/80 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Promote & Share Kit
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Spread voter turnout on social media or embed a candidate badge on your website.
              </CardDescription>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 pt-3">
            <button
              onClick={() => setActiveTab("social")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                activeTab === "social"
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Social Media Share
            </button>
            <button
              onClick={() => setActiveTab("embed")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                activeTab === "embed"
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Embed Website Badge
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Social Media Share Tab */}
          {activeTab === "social" && (
            <div className="space-y-4">
              {/* Visual Card Preview */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white space-y-3 shadow-lg relative overflow-hidden">
                <div className="absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase opacity-90 font-bold">
                    <Trophy className="w-3.5 h-3.5 text-amber-300" /> AwardOS Official Badge
                  </div>
                  <Badge variant="purple" size="sm" className="bg-white/20 text-white border-none">
                    Verified Ballot
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-extrabold tracking-tight leading-snug">
                    {nomineeName ? `Vote for ${nomineeName}` : eventName}
                  </h4>
                  <p className="text-xs text-blue-100 font-medium">
                    {categoryName ? `Category: ${categoryName}` : `Program: ${eventName}`}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-blue-100 font-mono">
                  <span>awardos.io/e/{eventSlug}</span>
                  <span className="font-bold text-white">Cast Your Vote →</span>
                </div>
              </div>

              {/* 1-Click Platform Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                {socialLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.name}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm ${item.color}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </a>
                  );
                })}
              </div>

              {/* Copy URL Link Input */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-slate-700">Direct Voting URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={targetUrl}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-xl px-3 py-2 border border-slate-200 font-mono font-medium focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95 border border-slate-800"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-blue-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Embed Website Badge Tab */}
          {activeTab === "embed" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-blue-600" /> Website Live Widget Preview
                </span>

                {/* Simulated Badge Widget */}
                <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
                      🏆
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{nomineeName || "Nominee Candidate"}</h5>
                      <span className="text-[10px] text-slate-500 font-medium">Official Nominee • AwardOS</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-sm">
                    Vote Now
                  </span>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>HTML Embed Code</span>
                  <span className="text-[10px] text-slate-500 font-normal">Paste into your website HTML</span>
                </label>
                <textarea
                  readOnly
                  rows={3}
                  value={embedSnippet}
                  className="w-full bg-slate-900 text-blue-300 text-[11px] rounded-xl p-3 font-mono border border-slate-800 focus:outline-none leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleCopyEmbed}
                className="w-full py-3 px-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {copiedEmbed ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Embed Snippet Copied!</span>
                  </>
                ) : (
                  <>
                    <Code className="w-4 h-4" />
                    <span>Copy Embed HTML Code</span>
                  </>
                )}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
