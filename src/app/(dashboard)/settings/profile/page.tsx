"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  User,
  ShieldCheck,
  Mail,
  Camera,
  Check,
  Save,
  Loader2,
  ArrowLeft,
  Key,
  Sparkles,
  Copy,
  BadgeCheck,
  Globe,
  Upload,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ui/image-upload";
import { getUserProfileAction, updateUserProfileFormAction } from "@/actions/users";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
];

export default function UserProfileSettingsPage() {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getUserProfileAction();
        if (data) {
          setProfile(data);
          setDisplayName(data.displayName || "");
          setAvatarUrl(data.avatarUrl || "");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const formData = new FormData();
    formData.append("displayName", displayName);
    formData.append("avatarUrl", avatarUrl);

    startTransition(async () => {
      const res = await updateUserProfileFormAction(formData);
      if (res.success) {
        setStatusMessage({ type: "success", text: res.message });
        setProfile((prev: any) => ({ ...prev, displayName, avatarUrl }));
      } else {
        setStatusMessage({ type: "error", text: res.message });
      }
    });
  };

  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-12">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button className="p-2 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              User Profile & Account
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage your display identity, avatar picture, and personal credentials.
            </p>
          </div>
        </div>

        <Badge variant="purple" size="md" className="hidden sm:inline-flex">
          <BadgeCheck className="w-3.5 h-3.5 mr-1 text-purple-600" /> Verified Account
        </Badge>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          {statusMessage.type === "success" && <Check className="w-4 h-4 text-emerald-600" />}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Avatar / DP Card */}
        <div className="space-y-6 md:col-span-1">
          <Card className="bg-white border-slate-200/80 rounded-3xl shadow-sm overflow-hidden text-center p-6 space-y-4">
            <div className="relative inline-block mx-auto">
              <div className="p-1 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 shadow-xl">
                <Avatar
                  src={avatarUrl || null}
                  name={displayName || "User"}
                  size="xl"
                  className="w-24 h-24 text-2xl ring-4 ring-white"
                />
              </div>
            </div>

            <div>
              <h3 className="font-extrabold text-slate-900 text-base">{displayName || "Your Name"}</h3>
              <p className="text-xs text-slate-500 font-mono truncate">{profile?.email}</p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3 text-left">
              <label className="text-xs font-bold text-slate-800 block">
                Upload Profile Picture
              </label>
              
              <ImageUpload
                value={avatarUrl}
                onChange={(url) => setAvatarUrl(url)}
                onRemove={() => setAvatarUrl("")}
                label="Click or Drag Photo Here"
                description="Select any image file from your device. Auto-compresses size."
                maxWidth={500}
                maxHeight={500}
                aspectRatio="square"
              />

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block">Avatar Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all hover:scale-105 ${
                        avatarUrl === url ? "border-blue-600 ring-2 ring-blue-500/20" : "border-slate-200"
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-[11px] font-bold text-rose-600 hover:underline block text-center w-full pt-1"
                  >
                    Clear Photo (Use Initials)
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Identity Form & Details */}
        <div className="space-y-6 md:col-span-2">
          <Card className="bg-white border-slate-200/80 rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" /> Personal Identity Details
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">
                This information is displayed on your workspace, event leaderboards, and audit logs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label htmlFor="displayName" className="text-xs font-bold text-slate-800">
                  Full Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Nelson Nlewedum"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>

              {/* Email Address (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Registered Email Address</span>
                  <Badge variant="success" size="sm">
                    <ShieldCheck className="w-3 h-3 mr-1" /> VERIFIED
                  </Badge>
                </label>
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100/70 border border-slate-200 text-slate-700 text-xs font-mono font-medium">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>

              {/* Auth Provider Info */}
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" /> Authentication Provider
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-blue-700 font-extrabold">
                    {profile?.authProvider || "GOOGLE SSO"}
                  </span>
                </div>
                <p className="text-[11px] text-blue-900/80 font-medium leading-relaxed">
                  Your identity is protected by OAuth 2.0 single sign-on.
                </p>
              </div>

              {/* Unique User ID */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-700">Account ID Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={profile?.id || ""}
                    className="w-full bg-slate-50 text-slate-600 text-xs rounded-xl px-3 py-2 border border-slate-200 font-mono font-medium focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyId}
                    className="shrink-0 rounded-xl bg-white border-slate-200 text-slate-700 font-bold"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-slate-100 pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={isPending}
                className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 shadow-md shadow-blue-600/20"
              >
                {isPending ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                <span>{isPending ? "Saving Profile..." : "Save Profile Changes"}</span>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
