"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Copy, Check, Trash2, Plus, Settings, Loader2, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getWorkspaceMembersAction, getWorkspaceInvitesAction, getWorkspaceAuditLogsAction, generateWorkspaceInviteAction, revokeWorkspaceInviteAction, getCustomRolesAction, createCustomRoleAction, deleteCustomRoleAction, removeWorkspaceMemberAction, updateWorkspaceMemberRoleAction } from "@/actions/members";
import { getAppOrigin } from "@/lib/app-url";
import { useToast } from "@/components/ui/toast";
import { LoadError } from "@/components/shared/load-error";

type WorkspaceMember = Awaited<ReturnType<typeof getWorkspaceMembersAction>>[number];
type WorkspaceInvite = Awaited<ReturnType<typeof getWorkspaceInvitesAction>>[number];
type WorkspaceAuditLog = Awaited<ReturnType<typeof getWorkspaceAuditLogsAction>>[number];
type CustomRole = Awaited<ReturnType<typeof getCustomRolesAction>>[number];
type InviteRole = "OWNER" | "ADMIN" | "EVENT_MANAGER" | "JUDGE" | "REVIEWER" | "SECRETARY" | "PRO" | "VOLUNTEER" | "CUSTOM";
type GeneratedInvite = Awaited<ReturnType<typeof generateWorkspaceInviteAction>> & { url: string };
type MemberWithStatus = WorkspaceMember & { statusBadge: "neutral" | "success" | "default" };

export default function WorkspaceTeamPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"members" | "invites" | "roles" | "audit">("members");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Data states
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [customRolesList, setCustomRolesList] = useState<CustomRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<WorkspaceAuditLog[]>([]);

  // Invite form states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("EVENT_MANAGER");
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>("");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpiresDays, setInviteExpiresDays] = useState(7);
  const [inviteDomains, setInviteDomains] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedInviteResult, setGeneratedInviteResult] = useState<GeneratedInvite | null>(null);

  // Copied links state
  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null);

  // Custom roles form states
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [creatingRole, setCreatingRole] = useState(false);

  // Loading/submitting action states
  const [submittingActionId, setSubmittingActionId] = useState<string | null>(null);

  const permissionCatalog = [
    { key: "manage_team", label: "Manage Team", desc: "Invite, remove, and change workspace members." },
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

  const loadData = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [membersData, invitesData, rolesData, auditData] = await Promise.all([
        getWorkspaceMembersAction(),
        getWorkspaceInvitesAction(),
        getCustomRolesAction(),
        getWorkspaceAuditLogsAction(),
      ]);
      setMembers(membersListWithStatus(membersData));
      setInvites(invitesData);
      setCustomRolesList(rolesData);
      setAuditLogs(auditData);
    } catch (err) {
      console.error("Failed to load workspace team access details:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const membersListWithStatus = (list: WorkspaceMember[]): MemberWithStatus[] => {
    return list.map(m => {
      let statusBadge = "neutral";
      if (m.status === "ACTIVE") statusBadge = "success";
      if (m.status === "PENDING") statusBadge = "default";
      return { ...m, statusBadge: statusBadge as "neutral" | "success" | "default" };
    });
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loadError) return <LoadError onRetry={() => void loadData()} />;

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
        role: inviteRole === "CUSTOM" ? "EVENT_MANAGER" : inviteRole,
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
      toast.error("Error generating invitation link.");
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
    } catch (err: unknown) {
      console.error("Error removing member:", err);
      toast.error(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setSubmittingActionId(null);
    }
  };

  const handleRoleChange = async (memberId: string, value: string) => {
    setSubmittingActionId(memberId);
    try {
      await updateWorkspaceMemberRoleAction(memberId, value as Exclude<InviteRole, "CUSTOM">);
      await loadData();
      toast.success("Member role updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update member role.");
    } finally {
      setSubmittingActionId(null);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error("Please enter a role name.");
      return;
    }
    if (selectedPerms.length === 0) {
      toast.error("Please select at least one permission rule.");
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
        <Loader2 className="animate-spin rounded-full h-8 w-8 text-accent" />
      </div>
    );
  }

  const isEmailTargeted = Boolean(inviteEmail && inviteEmail.trim().length > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans pb-12 select-none animate-page-entrance text-content">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-accent" />
            <span>Workspace team & access control</span>
          </h1>
          <p className="text-content-secondary text-xs mt-1 font-normal">
            Configure permission roles, monitor active members, and create restricted access links.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setGeneratedInviteResult(null);
            setShowInviteModal(true);
          }}
          className="rounded-xl font-semibold text-xs px-4"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          <span>Generate invite link</span>
        </Button>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-border-subtle overflow-x-auto pb-1">
        {[
          { id: "members", label: "Active members", icon: Users },
          { id: "invites", label: "Invitations & links", icon: Copy },
          { id: "roles", label: "Custom roles manager", icon: Settings },
          { id: "audit", label: "Audit log", icon: Settings },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-semibold shrink-0 transition-all border-b-2 ${
                isActive
                  ? "bg-accent/10 text-accent border-accent"
                  : "text-content-secondary border-transparent hover:text-content hover:bg-surface-raised"
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? "text-accent" : "text-content-secondary"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content 1: Members list */}
      {activeTab === "members" && (
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardContent className="pt-6">
            {members.length === 0 ? (
              <div className="text-center text-content-secondary py-8 text-xs italic font-normal">No members assigned to this workspace.</div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {members.map((m) => {
                  const isCurrentAction = submittingActionId === m.id;
                  return (
                    <div key={m.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.userName || m.userEmail || "M"} size="sm" />
                        <div>
                          <div className="font-bold text-content text-sm">{m.userName || "Pending User"}</div>
                          <div className="text-xs text-content-secondary mt-0.5 font-normal">{m.userEmail}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Badge variant={m.statusBadge} size="sm">
                          {m.status.toLowerCase()}
                        </Badge>
                        <Badge variant="default" size="sm" className="font-mono text-xs">
                          {m.customRoleName ? m.customRoleName : m.role}
                        </Badge>

                        <select
                          aria-label={`Change role for ${m.userName || m.userEmail}`}
                          value={m.role}
                          disabled={isCurrentAction || m.status !== "ACTIVE"}
                          onChange={(event) => void handleRoleChange(m.id, event.target.value)}
                          className="h-8 rounded-md border border-border-subtle bg-surface px-2 text-xs text-content disabled:opacity-50"
                        >
                          <option value="OWNER" disabled={m.role !== "OWNER"}>Owner (transfer by invitation)</option>
                          <option value="ADMIN">Admin</option>
                          <option value="EVENT_MANAGER">Event manager</option>
                          <option value="JUDGE">Judge</option>
                          <option value="REVIEWER">Reviewer</option>
                          <option value="SECRETARY">Secretary</option>
                          <option value="PRO">Pro</option>
                          <option value="VOLUNTEER">Volunteer</option>
                        </select>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCurrentAction}
                          onClick={() => handleRemoveMember(m.id)}
                          aria-label="Remove member"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 rounded-xl"
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
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardContent className="pt-6 space-y-4">
            <h3 className="text-sm font-bold text-content">Active invitation links</h3>
            {invites.length === 0 ? (
              <div className="text-center text-content-secondary py-8 text-xs italic font-normal">No workspace invitation links logged.</div>
            ) : (
              <div className="space-y-3">
                {invites.map((inv) => {
                  const isCurrentAction = submittingActionId === inv.id;
                  const inviteUrl = `${window.location.origin}/invite/${inv.token}`;
                  const isCopied = copiedLinkUrl === inviteUrl;

                  return (
                    <div key={inv.id} className="p-4 rounded-xl bg-surface-raised border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-content">Role: {inv.customRoleName || inv.role}</span>
                          {inv.email && (
                            <Badge variant="default" size="sm" className="font-mono text-xs">
                              Direct: {inv.email}
                            </Badge>
                          )}
                          <Badge variant="neutral" size="sm">
                            {inv.usesCount} / {inv.maxUses === 9999 ? "∞" : inv.maxUses} used
                          </Badge>
                          {inv.expiresAt && (
                            <span className="text-xs text-content-secondary font-normal">
                              Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-xs text-accent truncate max-w-lg select-all">
                          {inviteUrl}
                        </div>
                        {Array.isArray(inv.domainRestrictions) && inv.domainRestrictions.length > 0 && (
                          <div className="text-xs text-content-secondary font-normal">
                            Restricted to: <strong className="text-content">{inv.domainRestrictions.filter((d): d is string => typeof d === "string").join(", ")}</strong>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(inviteUrl)}
                          className="rounded-xl font-semibold text-xs"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-success mr-1" />
                              <span className="text-success">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-accent mr-1" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCurrentAction}
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 rounded-xl"
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
            <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-content">Create custom role</CardTitle>
                <CardDescription className="text-xs text-content-secondary font-normal">
                  Create roles with fine-grained permission configs.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleCreateCustomRole} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-content">Role name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Auditor"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-content block">Permissions catalog</label>
                    <div className="max-h-60 overflow-y-auto space-y-2 border border-border-subtle p-3 rounded-xl bg-surface-raised">
                      {permissionCatalog.map((p) => {
                        const checked = selectedPerms.includes(p.key);
                        return (
                          <div
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                              checked
                                ? "bg-accent/10 border-accent text-accent font-semibold"
                                : "bg-surface border-border-subtle text-content hover:bg-surface-raised"
                            }`}
                          >
                            <div className="font-bold text-xs flex items-center justify-between">
                              <span>{p.label}</span>
                              {checked && <span className="text-accent font-bold">✓</span>}
                            </div>
                            <p className="text-xs text-content-secondary mt-0.5 leading-snug font-normal">{p.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={creatingRole}
                    className="w-full rounded-xl font-semibold text-xs px-4"
                  >
                    {creatingRole ? (
                      <Loader2 className="animate-spin w-4 h-4 mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    <span>Create custom role</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* List custom roles */}
          <div className="lg:col-span-2">
            <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-content">Custom roles directory</CardTitle>
                <CardDescription className="text-xs text-content-secondary font-normal">
                  Active roles catalogue defined in this workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {customRolesList.length === 0 ? (
                  <div className="text-center text-content-secondary py-8 text-xs italic font-normal">No custom roles created yet.</div>
                ) : (
                  customRolesList.map((cr) => {
                    const isCurrentAction = submittingActionId === cr.id;
                    const perms = cr.permissions as string[];

                    return (
                      <div key={cr.id} className="p-4 rounded-xl bg-surface-raised border border-border-subtle flex items-start justify-between gap-4 text-xs">
                        <div className="space-y-2 min-w-0">
                          <h4 className="font-bold text-content text-sm">{cr.name}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {perms.map((p) => (
                              <Badge key={p} variant="default" size="sm" className="font-mono text-xs lowercase">
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
                          aria-label="Delete custom role"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 rounded-xl shrink-0"
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

      {activeTab === "audit" && (
        <Card className="border-border-subtle bg-surface rounded-2xl shadow-sm text-content">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-content">Workspace audit log</CardTitle>
            <CardDescription className="text-xs text-content-secondary font-normal">Recent governance and workspace activity visible to owners and admins.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-content-secondary">No audit activity recorded yet.</div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 py-3 text-xs">
                    <div>
                      <div className="font-semibold text-content">{log.action}</div>
                      <div className="mt-1 text-content-secondary">{log.actorName || log.actorEmail || "System actor"}{log.targetType ? ` · ${log.targetType}` : ""}</div>
                    </div>
                    <time className="shrink-0 text-content-secondary" dateTime={log.createdAt.toISOString()}>{new Date(log.createdAt).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite Member Link Generator Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border-subtle rounded-2xl max-w-md w-full font-sans shadow-xl relative p-6 space-y-4 text-content animate-page-entrance">
            <button
              onClick={() => setShowInviteModal(false)}
              aria-label="Close modal"
              className="absolute right-4 top-4 p-1 text-content-secondary hover:text-content rounded-xl hover:bg-surface-raised"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-content">Workspace invitation studio</h3>
              <p className="text-xs text-content-secondary font-normal mt-0.5">
                Create a targeted link for a recipient or a shareable access link. AwardOS does not send email from this screen.
              </p>
            </div>

            <div className="pt-2">
              {generatedInviteResult ? (
                <div className="space-y-4 animate-page-entrance">
                  <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 space-y-3">
                    <p className="text-content text-xs leading-relaxed font-semibold flex items-start gap-2">
                      <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <span>
                        {generatedInviteResult.directMemberAdded
                          ? `A restricted invitation link was created for ${generatedInviteResult.targetEmail}. Share the link with them to finish joining.`
                          : generatedInviteResult.targetEmail
                          ? `Targeted invitation link generated for ${generatedInviteResult.targetEmail}:`
                          : `Shareable invitation link generated successfully:`}
                      </span>
                    </p>
                    <div className="p-3 bg-surface rounded-xl text-accent font-mono text-xs select-all break-all border border-border-subtle shadow-sm font-semibold">
                      {generatedInviteResult.url}
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleCopyLink(generatedInviteResult.url)}
                      className="flex-1 rounded-xl font-semibold text-xs px-4"
                    >
                      {copiedLinkUrl === generatedInviteResult.url ? (
                        <>
                          <Check className="w-4 h-4 text-success mr-1.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1.5" />
                          <span>Copy link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setGeneratedInviteResult(null)}
                      className="flex-1 rounded-xl font-semibold text-xs px-4"
                    >
                      <span>Create another</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleGenerateInvite} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-content flex items-center justify-between">
                        <span>Target recipient email</span>
                        <span className="text-xs text-content-secondary font-normal">Optional</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. colleague@university.edu"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-normal"
                      />
                      <p className="text-xs text-content-secondary font-normal">
                        {isEmailTargeted
                          ? "✓ Direct email targeted: Restricted to 1 recipient."
                          : "Leave empty to generate a shareable open link."}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-content">Select member role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => {
                          setInviteRole(e.target.value as InviteRole);
                          if (e.target.value !== "CUSTOM") setSelectedCustomRoleId("");
                        }}
                        className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none font-normal"
                      >
                        <option value="EVENT_MANAGER">Event Manager</option>
                        <option value="ADMIN">Administrator</option>
                        <option value="OWNER">Workspace Owner</option>
                        {customRolesList.length > 0 && <option value="CUSTOM">Custom Role...</option>}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-content">Custom role profile</label>
                      <select
                        disabled={inviteRole !== "CUSTOM"}
                        value={selectedCustomRoleId}
                        onChange={(e) => setSelectedCustomRoleId(e.target.value)}
                        className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none disabled:opacity-40 font-normal"
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
                      <label className="text-xs font-semibold text-content">Expiration timeline</label>
                      <select
                        value={inviteExpiresDays}
                        onChange={(e) => setInviteExpiresDays(Number(e.target.value))}
                        className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none font-normal"
                      >
                        <option value={1}>1 Day</option>
                        <option value={7}>7 Days</option>
                        <option value={30}>30 Days</option>
                        <option value={0}>Never Expire</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-content flex items-center justify-between">
                        <span>Max usage budget</span>
                        {isEmailTargeted && <span className="text-xs text-accent font-semibold">1 Use</span>}
                      </label>
                      <select
                        disabled={isEmailTargeted}
                        value={isEmailTargeted ? 1 : inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(Number(e.target.value))}
                        className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none disabled:opacity-50 font-normal"
                      >
                        <option value={1}>1 Usage (Single User)</option>
                        <option value={5}>5 Usages</option>
                        <option value={10}>10 Usages</option>
                        <option value={9999}>Unlimited Usages</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-content">Allowed email domains</label>
                      <input
                        type="text"
                        placeholder="e.g. university.edu, company.com"
                        value={inviteDomains}
                        onChange={(e) => setInviteDomains(e.target.value)}
                        className="w-full bg-surface-raised text-content text-xs rounded-xl px-3.5 py-2 border border-border-subtle focus:outline-none focus:border-accent font-mono font-normal"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <Button
                      type="submit"
                      disabled={generatingLink}
                      className="rounded-xl font-semibold text-xs px-4"
                    >
                      {generatingLink ? (
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      <span>{isEmailTargeted ? "Create targeted link" : "Create invitation link"}</span>
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

