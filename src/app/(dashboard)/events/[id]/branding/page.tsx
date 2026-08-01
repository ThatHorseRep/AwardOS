"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Palette,
  Sparkles,
  ArrowLeft,
  Check,
  Eye,
  Layout,
  Sun,
  Moon,
  Zap,
  Crown,
  Save,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ui/image-upload";
import { getEventDetailsAction, updateEventBrandingAction } from "@/actions/events";

export default function EventBrandingPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<any | null>(null);
  const [selectedPreset, setSelectedPreset] = useState("dark-glass");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [accentColor, setAccentColor] = useState("#a855f7");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const presets = [
    { id: "dark-glass", name: "Dark Glassmorphism", icon: Moon, primary: "#6366f1", accent: "#a855f7", desc: "Default dark aesthetic with sleek backdrop blur" },
    { id: "royal-gold", name: "Royal Gold Gala", icon: Crown, primary: "#f59e0b", accent: "#d97706", desc: "Elegant gold tones for formal award ceremonies" },
    { id: "cyber-neon", name: "Cyberpunk Neon", icon: Zap, primary: "#ec4899", accent: "#06b6d4", desc: "Vibrant neon gradients for tech summits" },
    { id: "clean-light", name: "Clean Minimal Light", icon: Sun, primary: "#2563eb", accent: "#3b82f6", desc: "Crisp corporate light aesthetic" },
  ];

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getEventDetailsAction(eventId);
        setEventData(data);
        if (data?.branding) {
          if (data.branding.primaryColor) setPrimaryColor(data.branding.primaryColor);
          if (data.branding.accentColor) setAccentColor(data.branding.accentColor);
          if (data.branding.logoUrl) setLogoUrl(data.branding.logoUrl);
          if (data.branding.bannerUrl) setBannerUrl(data.branding.bannerUrl);
        }
      } catch (err) {
        console.error("Failed to load event details for branding:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [eventId]);

  const handleSelectPreset = (preset: typeof presets[0]) => {
    setSelectedPreset(preset.id);
    setPrimaryColor(preset.primary);
    setAccentColor(preset.accent);
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await updateEventBrandingAction({
        eventId,
        primaryColor,
        accentColor,
        secondaryColor: primaryColor,
        logoUrl,
        bannerUrl,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error("Failed to save branding:", err);
      alert("Error saving branding changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-indigo-500" />
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="text-center py-12 text-slate-300 font-sans">
        <h2 className="text-xl font-bold text-white">Event not found</h2>
        <Link href="/events" className="mt-4 inline-block text-indigo-400 hover:underline">
          Back to Events List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href={`/events/${eventId}`}>
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Palette className="w-6 h-6 text-purple-400" />
              <span>Event Branding Studio</span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Customize portal theme presets, primary & accent colors, and custom hero banners for <strong className="text-slate-200">{eventData.name}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/e/${eventData.slug}`} target="_blank">
            <Button variant="outline" size="sm" className="border-slate-800 text-slate-200">
              <Eye className="w-4 h-4 mr-2" />
              <span>Live Portal Preview</span>
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            disabled={saving}
            onClick={handleSaveBranding}
            className="bg-purple-600 hover:bg-purple-500 border-purple-400/30 text-white"
          >
            {saving ? (
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
            ) : savedSuccess ? (
              <Check className="w-4 h-4 text-emerald-300 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            <span>{savedSuccess ? "Branding Saved!" : "Save Branding"}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Preset Selection & Color Pickers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preset Theme Selection */}
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Theme Presets</span>
              </CardTitle>
              <CardDescription className="text-xs">Choose a pre-built visual theme for your event portal</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {presets.map((p) => {
                  const Icon = p.icon;
                  const isSelected = selectedPreset === p.id;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                        isSelected
                          ? "bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-600/15"
                          : "bg-slate-900/40 border-slate-800 hover:border-slate-700 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-purple-400" />
                          <h4 className="text-xs font-bold text-white">{p.name}</h4>
                        </div>
                        {isSelected && <Badge variant="purple" size="sm">Active</Badge>}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Color Customization & Logo Assets */}
          <Card className="border-slate-800 bg-slate-950/20">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-400" />
                <span>Color Palette & Brand Assets</span>
              </CardTitle>
              <CardDescription className="text-xs font-medium">Fine-tune primary/accent color tokens and upload compressed brand image assets</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Primary Theme Color</label>
                  <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 uppercase">{primaryColor}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Accent Highlight Color</label>
                  <div className="flex items-center gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-300 uppercase">{accentColor}</span>
                  </div>
                </div>
              </div>

              {/* Upload Brand Assets */}
              <div className="space-y-6 pt-2 border-t border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-200 block">Event Program Logo Photo</label>
                  <ImageUpload
                    value={logoUrl}
                    onChange={(url) => setLogoUrl(url)}
                    onRemove={() => setLogoUrl("")}
                    label="Upload Event Logo Image"
                    description="Upload your organization or event logo photo. Automatically compressed."
                    maxWidth={400}
                    maxHeight={400}
                    aspectRatio="square"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-200 block">Custom Hero Cover Banner Photo</label>
                  <ImageUpload
                    value={bannerUrl}
                    onChange={(url) => setBannerUrl(url)}
                    onRemove={() => setBannerUrl("")}
                    label="Upload Event Hero Cover Banner"
                    description="Upload a widescreen header banner photo for your event landing page."
                    maxWidth={1200}
                    maxHeight={600}
                    aspectRatio="landscape"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Live Public Portal Mockup Preview */}
        <div className="space-y-4">
          <Card className="sticky top-20 border-slate-800 bg-slate-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Layout className="w-4 h-4 text-purple-400" />
                <span>Live Portal Preview</span>
              </CardTitle>
              <CardDescription className="text-xs">Real-time mockup of event landing page</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 shadow-xl">
                {/* Simulated Portal Banner */}
                <div
                  style={{
                    background: bannerUrl ? `url(${bannerUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${primaryColor}40, ${accentColor}30)`,
                    borderColor: `${primaryColor}60`,
                  }}
                  className="p-4 rounded-xl border text-center space-y-1.5 min-h-[100px] flex flex-col justify-center relative overflow-hidden"
                >
                  {bannerUrl && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]" />}
                  <div className="relative z-10">
                    {logoUrl && <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain mx-auto mb-1 rounded-lg" />}
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider block">
                      {eventData.name}
                    </span>
                    <p className="text-[11px] text-slate-300">Official Recognition Portal</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    style={{ backgroundColor: primaryColor }}
                    className="w-full py-2 rounded-xl text-white text-xs font-bold shadow-md"
                  >
                    Nominate Candidate
                  </button>
                  <button
                    style={{ borderColor: accentColor, color: accentColor }}
                    className="w-full py-2 rounded-xl border text-xs font-bold bg-slate-900"
                  >
                    Cast Ballot
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
