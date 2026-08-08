"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  Copy,
  Check,
  Trash2,
  Lock,
  Plus,
  Settings,
  ShieldAlert,
  Loader2,
  Calendar,
  X,
  Undo2,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  getWorkspaceMembersAction,
  getWorkspaceInvitesAction,
  generateWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
  getCustomRolesAction,
  createCustomRoleAction,
  deleteCustomRoleAction,
  removeWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
} from "@/actions/members";
import { getAppOrigin } from "@/lib/app-url";

export default function WorkspaceTeamPage() {
  const [activeTab, setActiveTab] = useState<"members" | "invites" | "roles">("members");
  const [loading, setLoading] = useState(true);

  // Data states
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [customRolesList, setCustomRolesList] = useState<any[]>([]);

  // Invite form states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<any>("EVENT_MANAGER");
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>("");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpiresDays, setInviteExpiresDays] = useState(7);
  const [inviteDomains, setInviteDomains] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedInviteResult, setGeneratedInviteResult] = useState<any | null>(null);

  // Copied links state
  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null);

  // Custom roles form states
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [creatingRole, setCreatingRole] = useState(false);

  // Loading/submitting action states
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(null);

  const permissionCatalog = [
    { key: "manage_events", label: "Manage Events", desc: "Create, duplicate, or delete events." },
    { key: "manage_categories", label: "Manage Categories", desc: "Add, update, or remove event categories." },
    { key: "manage_nominees", label: "Manage Nominees", desc: "Configure nominee profiles and photos." },
    { key: "manage_workflow", label: "Workflow Pipeline", desc: "Transition stages, schedule starts/ends." },
    { key: "manage_branding", label: "Edit Branding Assets", desc: "Customize logos, header images, and color palettes." },
    { key: "view_results", label: "View Live Results", desc: "Audit dynamic vote counts before publishing." },
    { key: "publish_results", label: "Publish Results", desc: "Toggle results leaderboard visibility publicly." },
    { key: "view_analytics", label: "View Analytics", desc: "Access turnout velocity and browser telemetry." },
    { key: "manage_integrity", label: "Security & Integrity", desc: "Disqualify IP clusters, audit duplicate profiles." },
  ];

  const loadData = async () => {
    try {
      const [membersData, invitesData, rolesData] = await Promise.all([
        getWorkspaceMembersAction(),
        getWorkspaceInvitesAction(),
        getCustomRolesAction(),
      ]);
      setMembers(membersListWithStatus(membersData));
      setInvites(invitesData);
      setCustomRolesList(rolesData);
    } catch (err) {
      console.error("Failed to load workspace team access details:", err);
    } finally {
      setLoading(false);
    }
  };

  const membersListWithStatus = (list: any[]) => {
    return list.map(m => {
      let statusBadge = "neutral";
      if (m.status === "ACTIVE") statusBadge = "success";
      if (m.status === "PENDING") statusBadge = "purple";
      return { ...m, statusBadge };
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingLink(true);
    setGeneratedInviteResult(null);
    try {
      const domains = inviteDomains
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d.length > 0);

      const isEmailTargeted = Boolean(inviteEmail && inviteEmail.trim().length > 0);

      const invite = await generateWorkspaceInviteAction({
        email: inviteEmail.trim() || undefined,
        role: inviteRole,
        customRoleId: selectedCustomRoleId || undefined,
        maxUses: isEmailTargeted ? 1 : inviteMaxUses,
        expiresDays: inviteExpiresDays,
        domainRestrictions: domains,
      });

      const origin = getAppOrigin();
      const url = `${origin}/invite/${invite.token}`;

      setGeneratedInviteResult({
        ...invite,
        url,
      });
      await loadData();
    } catch (err) {
      console.error("Failed to generate invite:", err);
      alert("Error generating invitation link.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkUrl(url);
    setTimeout(() => setCopiedLinkUrl(null), 2500);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation link? Any unused uses will be invalidated.")) return;
    setSubmittingActionId(inviteId);
    try {
      await revokeWorkspaceInviteAction(inviteId);
      await loadData();
    } catch (err) {
      console.error("Error revoking invite:", err);
    } finally {
      setSubmittingActionId(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return;
    setSubmittingActionId(memberId);
    try {
      await removeWorkspaceMemberAction(memberId);
      await loadData();
    } catch (err: any) {
      console.error("Error removing member:", err);
      alert(err.message || "Failed to remove member.");
    } finally {
      setSubmittingActionId(null);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      alert("Please enter a role name.");
      return;
    }
    if (selectedPerms.length === 0) {
      alert("Please select at least one permission rule.");
      return;
    }
    setCreatingRole(true);
    try {
      await createCustomRoleAction(newRoleName.trim(), selectedPerms);
      setNewRoleName("");
      setSelectedPerms([]);
      await loadData();
    } catch (err) {
      console.error("Error creating custom role:", err);
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteCustomRole = async (roleId: string) => {
    if (!confirm("Are you sure you want to delete this custom role? Users assigned to it will fallback to event manager defaults.")) return;
    setSubmittingActionId(roleId);
    try {
      await deleteCustomRoleAction(roleId);
      await loadData();
    } catch (err) {
      console.error("Error deleting custom role:", err);
    } finally {
      setSubmittingActionId(null);
    }
  };

  const togglePermission = (key: string) => {
    if (selectedPerms.includes(key)) {
      setSelectedPerms(selectedPerms.filter((p) => p !== key));
    } else {
      setSelectedPerms([...selectedPerms, key]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const isEmailTargeted = Boolean(inviteEmail && inviteEmail.trim().length > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12 select-none">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <span>Workspace Team & Access Control</span>
          </h1>
          <p className="text-slate-600 text-xs mt-1 font-medium">
            Configure permission roles, monitor active members, and generate restricted access invitation links.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setGeneratedInviteResult(null);
            setShowInviteModal(true);
          }}
          className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          <span>Generate Invite Link</span>
        </Button>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: "members", label: "Active Members", icon: Users },
          { id: "invites", label: "Invitations & Links", icon: Copy },
          { id: "roles", label: "Custom Roles Manager", icon: Settings },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl text-xs font-bold shrink-0 transition-all border-b-2 ${
                isActive
                  ? "bg-blue-50 text-blue-600 border-blue-600"
                  : "text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-slate-500"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content 1: Members list */}
      {activeTab === "members" && (
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6">
            {members.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs italic font-medium">No members assigned to this workspace.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {members.map((m) => {
                  const isCurrentAction = submittingActionId === m.id;
                  return (
                    <div key={m.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.userName || m.userEmail || "M"} size="sm" />
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{m.userName || "Pending User"}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">{m.userEmail}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant={m.statusBadge} size="sm">
                          {m.status}
                        </Badge>
                        <Badge variant="purple" size="sm" className="font-mono text-[10px]">
                          {m.customRoleName ? m.customRoleName : m.role}
                        </Badge>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCurrentAction}
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2"
                        >
                          {isCurrentAction ? (
                            <Loader2 className="animate-spin w-3.5 h-3.5" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab content 2: Invites list */}
      {activeTab === "invites" && (
        <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Active Invitation Links</h3>
            {invites.length === 0 ? (
              <div className="text-center text-slate-500 py-8 text-xs italic font-medium">No workspace invitation links logged.</div>
            ) : (
              <div className="space-y-3">
                {invites.map((inv) => {
                  const isCurrentAction = submittingActionId === inv.id;
                  const inviteUrl = `${window.location.origin}/invite/${inv.token}`;
                  const isCopied = copiedLinkUrl === inviteUrl;

                  return (
                    <div key={inv.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">Role: {inv.customRoleName || inv.role}</span>
                          {inv.email && (
                            <Badge variant="purple" size="sm" className="font-mono text-[10px]">
                              Direct: {inv.email}
                            </Badge>
                          )}
                          <Badge variant="neutral" size="sm">
                            {inv.usesCount} / {inv.maxUses === 9999 ? "∞" : inv.maxUses} used
                          </Badge>
                          {inv.expiresAt && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-blue-600 truncate max-w-lg select-all">
                          {inviteUrl}
                        </div>
                        {inv.domainRestrictions?.length > 0 && (
                          <div className="text-[10px] text-slate-500 font-medium">
                            Restricted to: <strong className="text-slate-700">{inv.domainRestrictions.join(", ")}</strong>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(inviteUrl)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border border-slate-800"
                        >
                          {isCopied ? (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCurrentAction}
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8"
                        >
                          {isCurrentAction ? (
                            <Loader2 className="animate-spin w-3.5 h-3.5" />
                          ) : (
                            <span>Revoke</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab content 3: Roles catalog */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create custom role */}
          <div className="lg:col-span-1">
            <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900">Create Custom Role</CardTitle>
                <CardDescription className="text-xs text-slate-600 font-medium">
                  Create roles with target fine-grained permission configs.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleCreateCustomRole} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Role Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Auditor"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-slate-700 block">Permissions Catalog</label>
                    <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 p-3 rounded-2xl bg-slate-50">
                      {permissionCatalog.map((p) => {
                        const checked = selectedPerms.includes(p.key);
                        return (
                          <div
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              checked
                                ? "bg-blue-500/10 border-blue-500 text-blue-700 font-semibold"
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <div className="font-bold text-[11px] flex items-center justify-between">
                              <span>{p.label}</span>
                              {checked && <span className="text-blue-600 font-bold">✓</span>}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{p.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={creatingRole}
                    className="w-full rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                  >
                    {creatingRole ? (
                      <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    <span>Create Custom Role</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* List custom roles */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200/80 bg-white rounded-3xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900">Custom Roles Directory</CardTitle>
                <CardDescription className="text-xs text-slate-600 font-medium">
                  Active roles catalogue defined in this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {customRolesList.length === 0 ? (
                  <div className="text-center text-slate-500 py-8 text-xs italic font-medium">No custom roles created yet.</div>
                ) : (
                  customRolesList.map((cr) => {
                    const isCurrentAction = submittingActionId === cr.id;
                    const perms = cr.permissions as string[];

                    return (
                      <div key={cr.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-start justify-between gap-4 text-xs">
                        <div className="space-y-2 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm">{cr.name}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {perms.map((p) => (
                              <Badge key={p} variant="purple" size="sm" className="font-mono text-[9px] lowercase">
                                {p.replace("manage_", "").replace("view_", "").replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCurrentAction}
                          onClick={() => handleDeleteCustomRole(cr.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2 shrink-0"
                        >
                          {isCurrentAction ? (
                            <Loader2 className="animate-spin w-3.5 h-3.5" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Invite Member Link Generator Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full font-sans shadow-2xl relative p-6 space-y-4">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900">Workspace Invitation Studio</h3>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Send direct invitations via email or generate shareable access links.
              </p>
            </div>

            <div className="pt-2">
              {generatedInviteResult ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-3">
                    <p className="text-blue-950 text-xs leading-relaxed font-semibold flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        {generatedInviteResult.directMemberAdded
                          ? `Direct invitation issued for ${generatedInviteResult.targetEmail}! They have been added to the workspace and can accept via AwardOS or the link below.`
                          : generatedInviteResult.targetEmail
                          ? `Direct invitation link generated for ${generatedInviteResult.targetEmail}! Share this single-use link with them:`
                          : `Shareable invitation link generated successfully! Share this link with your team:`}
                      </span>
                    </p>
                    <div className="p-3 bg-white rounded-xl text-blue-600 font-mono text-[11px] select-all break-all border border-blue-200 shadow-sm font-semibold">
                      {generatedInviteResult.url}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(generatedInviteResult.url)}
                      className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 border border-slate-800"
                    >
                      {copiedLinkUrl === generatedInviteResult.url ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-blue-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setGeneratedInviteResult(null)}
                      className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 text-slate-800 hover:bg-slate-200 font-bold text-xs flex items-center justify-center transition-colors"
                    >
                      <span>Create Another</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGenerateInvite} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>Target Recipient Email</span>
                        <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. colleague@university.edu"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                      />
                      <p className="text-[10px] text-slate-500 font-medium">
                        {isEmailTargeted
                          ? "✓ Direct Email Targeted: Restricted to 1 recipient."
                          : "Leave empty to generate a shareable open link."}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Select Member Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e: any) => {
                          setInviteRole(e.target.value);
                          if (e.target.value !== "CUSTOM") setSelectedCustomRoleId("");
                        }}
                        className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none font-medium"
                      >
                        <option value="EVENT_MANAGER">Event Manager</option>
                        <option value="ADMIN">Administrator</option>
                        <option value="OWNER">Workspace Owner</option>
                        {customRolesList.length > 0 && <option value="CUSTOM">Custom Role...</option>}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Custom Role Profile</label>
                      <select
                        disabled={inviteRole !== "CUSTOM"}
                        value={selectedCustomRoleId}
                        onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none disabled:opacity-40 font-medium"
                      >
                        <option value="">Select custom role...</option>
                        {customRolesList.map((cr) => (
                          <option key={cr.id} value={cr.id}>
                            {cr.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Expiration Timeline</label>
                      <select
                        value={inviteExpiresDays}
                        onChange={(e: any) => setInviteExpiresDays(Number(e.target.value))}
                        className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none font-medium"
                      >
                        <option value={1}>1 Day</option>
                        <option value={7}>7 Days</option>
                        <option value={30}>30 Days</option>
                        <option value={0}>Never Expire</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                        <span>Max Usage Budget</span>
                        {isEmailTargeted && <span className="text-[10px] text-blue-600 font-bold">1 Use</span>}
                      </label>
                      <select
                        disabled={isEmailTargeted}
                        value={isEmailTargeted ? 1 : inviteMaxUses}
                        onChange={(e: any) => setInviteMaxUses(Number(e.target.value))}
                        className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none disabled:opacity-50 font-medium"
                      >
                        <option value={1}>1 Usage (Single User)</option>
                        <option value={5}>5 Usages</option>
                        <option value={10}>10 Usages</option>
                        <option value={9999}>Unlimited Usages</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-slate-700">Allowed Email Domains Restriction</label>
                      <input
                        type="text"
                        placeholder="e.g. university.edu, company.com (comma separated)"
                        value={inviteDomains}
                        onChange={(e) => setInviteDomains(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 text-xs rounded-2xl px-3.5 py-2.5 border border-slate-200 focus:outline-none focus:border-blue-500 font-mono font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <Button
                      type="submit"
                      disabled={generatingLink}
                      className="rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                    >
                      {generatingLink ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      <span>{isEmailTargeted ? "Send Direct Invitation" : "Create Invitation Link"}</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
