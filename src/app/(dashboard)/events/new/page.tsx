"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createEventAction } from "@/actions/events";
import {
  Trophy,
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  Calendar,
  Layers,
  ShieldCheck,
  Plus,
  Trash2,
  Globe,
  Lock,
  EyeOff,
  Clock,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NewEventWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Basics
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");

  // Step 2: Timeline
  const [nominationStart, setNominationStart] = useState("");
  const [nominationEnd, setNominationEnd] = useState("");
  const [votingStart, setVotingStart] = useState("");
  const [votingEnd, setVotingEnd] = useState("");

  // Step 3: Categories
  const [categories, setCategories] = useState([
    { id: "1", name: "Best Student Leader of the Year", description: "Recognizing outstanding student leadership." },
    { id: "2", name: "Innovation in Tech Award", description: "Awarded for exceptional technological contributions." },
  ]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  // Step 4: Verification & Trust
  const [verificationLevel, setVerificationLevel] = useState("STANDARD");
  const [audienceType, setAudienceType] = useState("PUBLIC");

  // Auto-generate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    setSlug(generatedSlug);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    setCategories([
      ...categories,
      {
        id: Date.now().toString(),
        name: newCatName.trim(),
        description: newCatDesc.trim(),
      },
    ]);
    setNewCatName("");
    setNewCatDesc("");
  };

  const handleRemoveCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
  };

  const handleSubmitEvent = async () => {
    if (!title.trim() || !slug.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await createEventAction({
        name: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        visibility: visibility as any,
        nominationStart: nominationStart || undefined,
        nominationEnd: nominationEnd || undefined,
        votingStart: votingStart || undefined,
        votingEnd: votingEnd || undefined,
        categories: categories.map((c) => ({ name: c.name, description: c.description })),
        verificationLevel: verificationLevel as any,
        audienceType: audienceType as any,
      });

      if (response.success) {
        router.push(`/dashboard/events/${response.eventId}`);
      } else {
        alert("Failed to create event");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: "Basics & Info", icon: Trophy },
    { num: 2, label: "Timeline", icon: Calendar },
    { num: 3, label: "Categories", icon: Layers },
    { num: 4, label: "Trust & Rules", icon: ShieldCheck },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/events">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Create New Recognition Event</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Set up your award event, categories, and voting pipeline step-by-step.
            </p>
          </div>
        </div>
      </div>

      {/* Wizard Step Stepper Progress */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step) => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          const Icon = step.icon;

          return (
            <button
              key={step.num}
              onClick={() => step.num < currentStep && setCurrentStep(step.num)}
              className={`p-3 rounded-2xl border flex items-center gap-3 text-left transition-all ${
                isCurrent
                  ? "bg-indigo-600/15 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-600/10"
                  : isDone
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-pointer"
                  : "bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isCurrent
                    ? "bg-indigo-600 text-white"
                    : isDone
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                  Step 0{step.num}
                </span>
                <span className="text-xs font-semibold truncate">{step.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step Content Cards */}
      <Card className="border-indigo-500/20">
        {/* Step 1: Basics & Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Event Details & Visibility</CardTitle>
              <CardDescription>
                Define the name, description, and accessibility settings for your award program.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Event Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Campus Excellence & Leadership Awards 2026"
                  className="w-full bg-slate-900/80 text-slate-200 text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Public URL Slug</label>
                <div className="flex items-center">
                  <span className="bg-slate-800/80 text-slate-400 text-xs px-3 py-2.5 rounded-l-xl border border-r-0 border-slate-800 font-mono">
                    awardos.io/e/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="campus-excellence-2026"
                    className="w-full bg-slate-900/80 text-slate-200 text-xs font-mono rounded-r-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:border-indigo-500/60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Description / Overview</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose, scope, and significance of this award program..."
                  className="w-full bg-slate-900/80 text-slate-200 text-xs rounded-xl p-3 border border-slate-800 focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Visibility Setting</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "PUBLIC", label: "Public", desc: "Listed on public directory", icon: Globe },
                    { id: "UNLISTED", label: "Unlisted", desc: "Accessible via direct link only", icon: EyeOff },
                    { id: "PRIVATE", label: "Private", desc: "Organizer & admin view only", icon: Lock },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setVisibility(item.id)}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          visibility === item.id
                            ? "bg-indigo-600/15 border-indigo-500/50 text-white"
                            : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <ItemIcon className="w-4 h-4 text-indigo-400 mb-1" />
                        <span className="text-xs font-semibold">{item.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </div>
        )}

        {/* Step 2: Timeline Milestones */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Schedule & Stage Timeline</CardTitle>
              <CardDescription>
                Set the opening and closing dates for nominations and voter balloting.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-center gap-3">
                <Clock className="w-5 h-5 text-purple-400 shrink-0" />
                <span>
                  AwardOS will automatically transition event stages when schedules are reached. You can also manually trigger stage progression anytime.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Nomination Phase
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Nominations Open</label>
                    <input
                      type="datetime-local"
                      value={nominationStart}
                      onChange={(e) => setNominationStart(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Nominations Close</label>
                    <input
                      type="datetime-local"
                      value={nominationEnd}
                      onChange={(e) => setNominationEnd(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <Check className="w-3.5 h-3.5" /> Voting Phase
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Voting Opens</label>
                    <input
                      type="datetime-local"
                      value={votingStart}
                      onChange={(e) => setVotingStart(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Voting Closes</label>
                    <input
                      type="datetime-local"
                      value={votingEnd}
                      onChange={(e) => setVotingEnd(e.target.value)}
                      className="w-full bg-slate-800 text-slate-200 text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        )}

        {/* Step 3: Categories Setup */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Award Categories</CardTitle>
              <CardDescription>
                Add categories for your award event. You can also reorder and edit categories anytime.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Category List */}
              <div className="space-y-3">
                {categories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center justify-center border border-indigo-500/20">
                        {idx + 1}
                      </span>
                      <div>
                        <h5 className="text-xs font-semibold text-white">{cat.name}</h5>
                        {cat.description && (
                          <p className="text-[11px] text-slate-400">{cat.description}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Category Box */}
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
                <h5 className="text-xs font-semibold text-slate-300">Add New Category</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Category Name (e.g. Student Leader of the Year)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Short Description or Criteria"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="bg-slate-800 text-slate-200 text-xs rounded-xl p-2.5 border border-slate-700 focus:outline-none"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddCategory}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </Button>
              </div>
            </CardContent>
          </div>
        )}

        {/* Step 4: Trust & Verification Rules */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Security, Verification & Audience</CardTitle>
              <CardDescription>
                Configure anti-bot protection, vote verification methods, and audience access controls.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Vote Verification Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setVerificationLevel("STANDARD")}
                    className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                      verificationLevel === "STANDARD"
                        ? "bg-indigo-600/15 border-indigo-500/50 text-white"
                        : "bg-slate-900/40 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-100">Standard Protection</span>
                      <Badge variant="success" size="sm">Default</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Cookie tracking, localStorage device fingerprints, and IP rate limits. Ideal for open public awards.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationLevel("ADVANCED")}
                    className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                      verificationLevel === "ADVANCED"
                        ? "bg-indigo-600/15 border-indigo-500/50 text-white"
                        : "bg-slate-900/40 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">Advanced OTP Verification</span>
                      <Badge variant="purple" size="sm">Strict</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Requires voters to verify via 6-digit Email OTP or single-use invitation codes before submitting.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <label className="text-xs font-medium text-slate-300">Target Audience</label>
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value)}
                  className="w-full bg-slate-900/80 text-slate-200 text-xs rounded-xl p-3 border border-slate-800 focus:outline-none"
                >
                  <option value="PUBLIC">Public — Anyone can participate</option>
                  <option value="STUDENTS">Students & Campus Community</option>
                  <option value="FACULTY">Faculty & Staff Only</option>
                  <option value="INVITE_ONLY">Invitation Only (Restricted Codes)</option>
                </select>
              </div>
            </CardContent>
          </div>
        )}

        {/* Wizard Bottom Navigation Buttons */}
        <CardFooter className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>

          {currentStep < 4 ? (
            <Button
              type="button"
              variant="primary"
              disabled={currentStep === 1 && !title.trim()}
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              <span>Continue to Step 0{currentStep + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              isLoading={isSubmitting}
              onClick={handleSubmitEvent}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/30"
            >
              <Check className="w-4 h-4" />
              <span>Launch Event Program</span>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
