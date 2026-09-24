"use client";

import { Suspense, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Camera,
  Loader2,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { AccountOption } from "@/components/account-select";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatCard,
  buttonClasses,
} from "@/components/ui";

interface SettingsData {
  workspace: {
    name: string;
    dmsSentThisPeriod: number;
  };
  instagramAccount: {
    id: string;
    username: string;
    instagramId: string;
    tokenExpiresAt: string | null;
    webhookSubscribed: boolean;
  } | null;
  instagramAccounts: Array<
    AccountOption & {
      tokenExpiresAt: string | null;
      webhookSubscribed: boolean;
    }
  >;
}

interface WorkspaceMembersData {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteUrl: string;
    expiresAt: string;
  }>;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [membersData, setMembersData] = useState<WorkspaceMembersData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((res) => res.json()),
      fetch("/api/workspace/members").then((res) => res.json()),
    ])
      .then(([statsPayload, membersPayload]) => {
        if (statsPayload.success) setData(statsPayload.data);
        if (membersPayload.success) setMembersData(membersPayload.data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function refreshMembers() {
    const res = await fetch("/api/workspace/members");
    const payload = await res.json();
    if (payload.success) setMembersData(payload.data);
  }

  async function disconnectInstagram(instagramAccountId: string) {
    if (!confirm("Disconnect Instagram? Campaigns for this account will stop sending DMs.")) {
      return;
    }

    setBusy(`disconnect:${instagramAccountId}`);
    await fetch("/api/instagram/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramAccountId }),
    });
    window.location.reload();
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);
    setBusy("invite");
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
      setInviteEmail("");
    } else {
      setMemberError(payload.error ?? "Could not invite member");
    }
    setBusy(null);
  }

  async function removeInvitation(invitationId: string) {
    setBusy(`invite:${invitationId}`);
    await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    await refreshMembers();
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  const accounts = data?.instagramAccounts ?? [];
  const canManageMembers =
    membersData?.currentUserRole === "OWNER" ||
    membersData?.currentUserRole === "ADMIN";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Connected accounts, your team, and workspace usage."
      />

      <div className="space-y-6">
        {/* Surfaces the ?instagram= code the OAuth routes redirect back with.
            Needs a Suspense boundary: useSearchParams in a prerendered client
            page fails the production build without one. */}
        <Suspense fallback={null}>
          <InstagramConnectNotice />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Instagram accounts</CardTitle>
            <Badge tone={accounts.length > 0 ? "success" : "warning"}>
              {accounts.length > 0 ? "Connected" : "Not connected"}
            </Badge>
          </CardHeader>

          {accounts.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No accounts connected"
              description="Connect an Instagram professional account to launch campaigns."
            />
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                      {account.username.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        @{account.username}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Token expires{" "}
                          {account.tokenExpiresAt
                            ? new Date(account.tokenExpiresAt).toLocaleDateString()
                            : "not available"}
                        </span>
                        <Badge tone={account.webhookSubscribed ? "success" : "warning"}>
                          {account.webhookSubscribed ? "Webhook ready" : "Webhook pending"}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    className="shrink-0"
                    onClick={() => disconnectInstagram(account.id)}
                    disabled={busy === `disconnect:${account.id}`}
                  >
                    {busy === `disconnect:${account.id}` ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Disconnecting…
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Disconnect
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-3 border-t border-border pt-5">
            <a
              href="/api/instagram/connect"
              className={buttonClasses("primary", "md")}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
              {accounts.length > 0 ? "Connect another account" : "Connect Instagram"}
            </a>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Users className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </span>
          </CardHeader>

          <div className="space-y-3">
            {membersData?.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {member.user.name ?? member.user.email ?? "Unknown member"}
                  </p>
                  <p className="truncate text-xs text-muted">{member.user.email}</p>
                </div>
                <Badge
                  tone={member.role === "OWNER" ? "accent" : "neutral"}
                  className="shrink-0"
                >
                  {member.role === "OWNER" && (
                    <Shield className="h-3 w-3" aria-hidden="true" />
                  )}
                  {member.role}
                </Badge>
              </div>
            ))}
          </div>

          {membersData?.invitations.length ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                Pending invites
              </p>
              <div className="space-y-3">
                {membersData.invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {invitation.email}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {invitation.role} · {invitation.inviteUrl}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void navigator.clipboard?.writeText(invitation.inviteUrl)
                        }
                      >
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeInvitation(invitation.id)}
                        disabled={busy === `invite:${invitation.id}`}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {canManageMembers && (
            <form
              onSubmit={inviteMember}
              className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-[1fr_140px_auto]"
            >
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@agency.com"
                required
              />
              <Select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as "ADMIN" | "MEMBER")
                }
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </Select>
              <Button type="submit" disabled={busy === "invite"}>
                {busy === "invite" ? (
                  "Inviting…"
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Invite
                  </>
                )}
              </Button>
              {memberError && (
                <p className="sm:col-span-3 text-sm text-error">{memberError}</p>
              )}
            </form>
          )}
        </Card>

        <StatCard
          label="DMs sent this month"
          value={data?.workspace.dmsSentThisPeriod ?? 0}
          icon={CheckCircle2}
          hint="Self-hosted — no plan limits."
        />
      </div>
    </div>
  );
}
