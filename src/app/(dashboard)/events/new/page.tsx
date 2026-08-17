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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/components/ui/toast";
import { getAppOrigin } from "@/lib/app-url";
export default function NewEventWizardPage() {
  const toast = useToast();
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
  const [categories, setCategories] = useState<{ id: string; name: string; description: string }[]>([]);
  const [template, setTemplate] = useState<"EMPTY" | "RECOGNITION">("EMPTY");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  // Step 4: Verification & Trust
  const [verificationLevel, setVerificationLevel] = useState("STANDARD");
  const [audienceType, setAudienceType] = useState("PUBLIC");

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

  const selectTemplate = (value: "EMPTY" | "RECOGNITION") => {
    setTemplate(value);
    setCategories(value === "EMPTY" ? [] : [
      { id: crypto.randomUUID(), name: "Leadership", description: "Recognizes sustained leadership and measurable impact." },
      { id: crypto.randomUUID(), name: "Community contribution", description: "Recognizes meaningful service to the community." },
      { id: crypto.randomUUID(), name: "Innovation", description: "Recognizes an original improvement, product, or program." },
    ]);
  };

  const handleSubmitEvent = async () => {
    if (!title.trim() || !slug.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await createEventAction({
        name: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        visibility: visibility as "PUBLIC" | "UNLISTED" | "PRIVATE",
        nominationStart: nominationStart || undefined,
        nominationEnd: nominationEnd || undefined,
        votingStart: votingStart || undefined,
        votingEnd: votingEnd || undefined,
        categories: categories.map((c) => ({ name: c.name, description: c.description })),
        verificationLevel: verificationLevel as "STANDARD" | "ADVANCED",
        audienceType: audienceType as "PUBLIC" | "STUDENTS" | "FACULTY" | "ALUMNI" | "INVITE_ONLY" | "MEMBERS",
      });

      if (response.success) {
        router.push(`/events/${response.eventId}`);
      } else {
        toast.error("Failed to create event");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
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
    <div className="max-w-4xl mx-auto space-y-6 font-sans select-none pb-16">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/events">
            <Button variant="ghost" size="icon" className="text-slate-700 hover:bg-slate-200">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Recognition Event</h1>
            <p className="text-slate-600 text-xs mt-0.5 font-medium">
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
                  ? "bg-blue-50 border-blue-400 text-blue-900 shadow-sm"
                  : isDone
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 cursor-pointer font-bold"
                  : "bg-white border-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                  isCurrent
                    ? "bg-blue-600 text-white"
                    : isDone
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
                  Step 0{step.num}
                </span>
                <span className="text-xs font-bold truncate">{step.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step Content Cards */}
      <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
        {/* Step 1: Basics & Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Event Details & Visibility</CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Define the name, description, and accessibility settings for your award program.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Event Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Campus Excellence & Leadership Awards 2026"
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-4 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Public URL Slug</label>
                <div className="flex items-center">
                  <span className="bg-slate-100 text-slate-600 text-xs px-3 py-2.5 rounded-l-2xl border border-r-0 border-slate-200 font-mono font-medium">
                    {getAppOrigin()}/e/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="campus-excellence-2026"
                    className="w-full bg-slate-50 text-slate-900 text-xs font-mono rounded-r-2xl px-3 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Description / Overview</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose, scope, and significance of this award program..."
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl p-3 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Visibility Setting</label>
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
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          visibility === item.id
                            ? "bg-blue-50 border-blue-400 text-slate-900 font-bold"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 font-medium"
                        }`}
                      >
                        <ItemIcon className="w-4 h-4 text-blue-600 mb-1" />
                        <span className="text-xs font-bold">{item.label}</span>
                        <span className="text-[10px] text-slate-500 leading-tight font-medium">{item.desc}</span>
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
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Schedule & Stage Timeline</CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Set the opening and closing dates for nominations and voter balloting.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 text-xs flex items-center gap-3 font-medium">
                <Clock className="w-5 h-5 text-purple-600 shrink-0" />
                <span>
                  AwardOS will automatically transition event stages when schedules are reached. You can also manually trigger stage progression anytime.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" /> Nomination Phase
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 font-medium">Nominations Open</label>
                    <input
                      type="datetime-local"
                      value={nominationStart}
                      onChange={(e) => setNominationStart(e.target.value)}
                      className="w-full bg-white text-slate-900 text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 font-medium">Nominations Close</label>
                    <input
                      type="datetime-local"
                      value={nominationEnd}
                      onChange={(e) => setNominationEnd(e.target.value)}
                      className="w-full bg-white text-slate-900 text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                    <Check className="w-3.5 h-3.5" /> Voting Phase
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 font-medium">Voting Opens</label>
                    <input
                      type="datetime-local"
                      value={votingStart}
                      onChange={(e) => setVotingStart(e.target.value)}
                      className="w-full bg-white text-slate-900 text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-600 font-medium">Voting Closes</label>
                    <input
                      type="datetime-local"
                      value={votingEnd}
                      onChange={(e) => setVotingEnd(e.target.value)}
                      className="w-full bg-white text-slate-900 text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none font-medium"
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
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Award Categories</CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Add categories for your award event. You can also reorder and edit categories anytime.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              <fieldset className="space-y-2"><legend className="text-xs font-semibold text-slate-700">Starting template</legend><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => selectTemplate("EMPTY")} className={`rounded-xl border p-3 text-left text-xs ${template === "EMPTY" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><span className="block font-bold">Start empty</span><span className="mt-1 block text-slate-600">Add only the categories this event needs.</span></button><button type="button" onClick={() => selectTemplate("RECOGNITION")} className={`rounded-xl border p-3 text-left text-xs ${template === "RECOGNITION" ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><span className="block font-bold">Recognition program</span><span className="mt-1 block text-slate-600">Begin with leadership, community, and innovation categories.</span></button></div></fieldset>
              {/* Category List */}
              <div className="space-y-3">
                {categories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">{cat.name}</h5>
                        {cat.description && (
                          <p className="text-[11px] text-slate-600 font-medium">{cat.description}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveCategory(cat.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Category Box */}
              <div className="p-4 rounded-2xl bg-white border border-dashed border-slate-300 space-y-3">
                <h5 className="text-xs font-bold text-slate-900">Add New Category</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Category Name (e.g. Student Leader of the Year)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="bg-slate-50 text-slate-900 text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none font-medium"
                  />
                  <input
                    type="text"
                    placeholder="Short Description or Criteria"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                    className="bg-slate-50 text-slate-900 text-xs rounded-xl p-2.5 border border-slate-200 focus:outline-none font-medium"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddCategory}
                  className="w-full sm:w-auto rounded-full bg-slate-100 text-slate-700 font-bold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  <span>Add Category</span>
                </Button>
              </div>
            </CardContent>
          </div>
        )}

        {/* Step 4: Trust & Verification Rules */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Security, Verification & Audience</CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium">
                Configure anti-bot protection, vote verification methods, and audience access controls.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Vote Verification Level</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setVerificationLevel("STANDARD")}
                    className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                      verificationLevel === "STANDARD"
                        ? "bg-blue-50 border-blue-400 text-slate-900 font-bold"
                        : "bg-white border-slate-200 text-slate-600 font-medium hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">Standard Protection</span>
                      <Badge variant="success" size="sm">Default</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      Cookie tracking, localStorage device fingerprints, and IP rate limits. Ideal for open public awards.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationLevel("ADVANCED")}
                    className={`p-4 rounded-2xl border text-left space-y-1 transition-all ${
                      verificationLevel === "ADVANCED"
                        ? "bg-blue-50 border-blue-400 text-slate-900 font-bold"
                        : "bg-white border-slate-200 text-slate-600 font-medium hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700">Advanced OTP Verification</span>
                      <Badge variant="purple" size="sm">Strict</Badge>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      Requires voters to verify via 6-digit Email OTP or single-use invitation codes before submitting.
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700">Target Audience</label>
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value)}
                  className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl p-3 border border-slate-200 focus:outline-none font-medium"
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
        <CardFooter className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(currentStep - 1)}
            className="rounded-full bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back</span>
          </Button>

          {currentStep < 4 ? (
            <Button
              type="button"
              variant="primary"
              disabled={currentStep === 1 && !title.trim()}
              onClick={() => setCurrentStep(currentStep + 1)}
              className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 shadow-md shadow-blue-600/20"
            >
              <span>Continue to Step 0{currentStep + 1}</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              isLoading={isSubmitting}
              onClick={handleSubmitEvent}
              className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-md shadow-emerald-600/20"
            >
              <Check className="w-4 h-4 mr-1.5" />
              <span>Launch Event Program</span>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
