"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { User, ShieldCheck, Mail, Check, Save, Loader2, ArrowLeft, Copy, BadgeCheck, Globe } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ui/image-upload";
import { getUserProfileAction, updateUserProfileFormAction } from "@/actions/users";
import { uploadProfileAvatarAction } from "@/actions/uploads";
import { LoadError } from "@/components/shared/load-error";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
];

export default function UserProfileSettingsPage() {
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getUserProfileAction>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true); setLoadError(false);
      try {
        const data = await getUserProfileAction();
        if (data) {
          setProfile(data);
          setDisplayName(data.displayName || "");
          setAvatarUrl(data.avatarUrl || "");
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [loadAttempt]);

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
        setProfile((prev) => prev ? { ...prev, displayName, avatarUrl } : prev);
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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }
  if (loadError) return <LoadError onRetry={() => setLoadAttempt((value) => value + 1)} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-12">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button 
              aria-label="Back to settings"
              className="p-2 rounded-xl bg-surface border border-border-subtle text-content-secondary hover:text-content hover:bg-surface-raised transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
              User profile & account
            </h1>
            <p className="text-xs text-content-secondary font-medium">
              Manage your display identity, avatar picture, and personal credentials.
            </p>
          </div>
        </div>

        <Badge variant="default" size="md" className="hidden sm:inline-flex">
          <BadgeCheck className="w-3.5 h-3.5 mr-1 text-accent" /> Verified account
        </Badge>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-page-entrance ${
            statusMessage.type === "success"
              ? "bg-success/10 border border-success/20 text-success"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}
        >
          <span>{statusMessage.text}</span>
          {statusMessage.type === "success" && <Check className="w-4 h-4 text-success" />}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Avatar / DP Card */}
        <div className="space-y-6 md:col-span-1">
          <Card className="bg-surface border-border-subtle rounded-2xl shadow-sm text-center p-6 space-y-4 text-content">
            <div className="relative inline-block mx-auto">
              <Avatar
                src={avatarUrl || null}
                name={displayName || "User"}
                size="xl"
                className="w-24 h-24 text-2xl ring-2 ring-border-subtle"
              />
            </div>

            <div>
              <h3 className="font-bold text-content text-base">{displayName || "Your Name"}</h3>
              <p className="text-xs text-content-secondary font-mono truncate">{profile?.email}</p>
            </div>

            <div className="pt-3 border-t border-border-subtle space-y-3 text-left">
              <label className="text-xs font-semibold text-content block">
                Upload profile picture
              </label>
              
              <ImageUpload
                upload={uploadProfileAvatarAction}
                value={avatarUrl}
                onChange={(url) => setAvatarUrl(url)}
                onRemove={() => setAvatarUrl("")}
                label="Click or drag photo here"
                description="Select any image file from your device. Auto-compressed."
                maxWidth={500}
                maxHeight={500}
                aspectRatio="square"
              />

              <div className="pt-2 border-t border-border-subtle space-y-2">
                <label className="text-xs font-semibold text-content-secondary block">Avatar presets</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      aria-label={`Preset ${idx + 1}`}
                      className={`relative rounded-xl overflow-hidden aspect-square border transition-all hover:scale-105 ${
                        avatarUrl === url ? "border-accent ring-2 ring-accent/20" : "border-border-subtle"
                      }`}
                    >
                      <Image src={url} alt={`Avatar preset ${idx + 1}`} fill sizes="96px" className="object-cover" />
                    </button>
                  ))}
                </div>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-xs font-semibold text-destructive hover:underline block text-center w-full pt-1"
                  >
                    Clear photo (use initials)
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Identity Form & Details */}
        <div className="space-y-6 md:col-span-2">
          <Card className="bg-surface border-border-subtle rounded-2xl shadow-sm text-content">
            <CardHeader className="border-b border-border-subtle pb-4">
              <CardTitle className="text-base font-bold text-content flex items-center gap-2">
                <User className="w-4 h-4 text-accent" /> Personal identity details
              </CardTitle>
              <CardDescription className="text-xs text-content-secondary font-normal">
                This information is displayed on your workspace, event leaderboards, and audit logs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label htmlFor="displayName" className="text-xs font-semibold text-content">
                  Full display name
                </label>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Nelson Nlewedum"
                  className="w-full px-3.5 py-2 bg-surface-raised border border-border-subtle rounded-xl text-xs text-content font-normal focus:outline-none focus:border-accent transition-all"
                />
              </div>

              {/* Email Address (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content flex items-center justify-between">
                  <span>Registered email address</span>
                  <Badge variant="success" size="sm">
                    <ShieldCheck className="w-3 h-3 mr-1" /> VERIFIED
                  </Badge>
                </label>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-raised border border-border-subtle text-content text-xs font-mono font-medium">
                  <Mail className="w-4 h-4 text-content-secondary shrink-0" />
                  <span className="truncate">{profile?.email}</span>
                </div>
              </div>

              {/* Auth Provider Info */}
              <div className="p-3.5 rounded-xl bg-surface-raised border border-border-subtle space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-content">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-accent" /> Authentication provider
                  </span>
                  <span className="font-mono text-xs uppercase tracking-wider text-accent font-bold">
                    {profile?.authProvider || "GOOGLE SSO"}
                  </span>
                </div>
                <p className="text-xs text-content-secondary font-normal leading-relaxed">
                  Your identity is protected by OAuth 2.0 single sign-on.
                </p>
              </div>

              {/* Unique User ID */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-content-secondary">Account ID token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={profile?.id || ""}
                    className="w-full bg-surface-raised text-content-secondary text-xs rounded-xl px-3 py-2 border border-border-subtle font-mono font-normal focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyId}
                    className="shrink-0 rounded-xl font-semibold"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border-subtle pt-4 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                disabled={isPending}
                className="rounded-xl font-semibold text-xs px-5 py-2 shadow-sm"
              >
                {isPending ? (
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                <span>{isPending ? "Saving profile..." : "Save profile changes"}</span>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
