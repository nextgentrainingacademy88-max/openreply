"use client";

/**
 * Campaign Detail
 *
 * Clicking a campaign opens this read-only view: a summary of the automation
 * on the left, and Insights / Preview tabs on the right. Edit and Stop/Resume
 * live in the top bar.
 */

import { CAMPAIGN_DEFAULTS } from "@/lib/automations/defaults";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Link as LinkIcon,
  MousePointerClick,
  Pause,
  Pencil,
  Percent,
  Play,
  Send,
  UserPlus,
  XCircle,
} from "lucide-react";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import { cn } from "@/lib/cn";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  StatCard,
} from "@/components/ui";

interface Campaign {
  id: string;
  name: string;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmTriggerEnabled: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  linkButtonLabel: string | null;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  followUpEnabled: boolean;
  followUpMessage: string | null;
  followUpDelayMinutes: number | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  isActive: boolean;
  instagramAccountId: string;
  instagramAccount: { username: string };
  trackedLinks?: {
    destinationUrl: string;
    label?: string | null;
    trackedUrl?: string;
  }[];
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    newFollowers: number;
    ctr: number;
  };
}

type Tab = "insights" | "preview";

export default function CampaignDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("insights");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const found = (payload.data as Campaign[]).find((c) => c.id === id);
        if (!found) return setNotFound(true);
        setCampaign(found);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!campaign) return;
    const acct = campaign.instagramAccountId;
    fetch(`/api/instagram/profile?instagramAccountId=${acct}`)
      .then((r) => r.json())
      .then((d) =>
        setAvatarUrl(d.success ? d.data.profilePictureUrl ?? null : null)
      )
      .catch(() => setAvatarUrl(null));

    if (campaign.postId) {
      fetch(`/api/instagram/posts?instagramAccountId=${acct}&limit=50`)
        .then((r) => r.json())
        .then((payload) => {
          if (!payload.success) return;
          const hit = (
            payload.data as {
              id: string;
              thumbnail_url?: string;
              media_url?: string;
            }[]
          ).find((p) => p.id === campaign.postId);
          setPostThumb(hit?.thumbnail_url ?? hit?.media_url ?? null);
        })
        .catch(() => setPostThumb(null));
    }
  }, [campaign]);

  async function toggleActive() {
    if (!campaign) return;
    setBusy(true);
    try {
      await fetch(`/api/automations?id=${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !campaign.isActive }),
      });
      setCampaign({ ...campaign, isActive: !campaign.isActive });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="panel h-64 animate-pulse rounded-2xl" />;
  }
  if (notFound || !campaign) {
    return (
      <Card>
        <EmptyState
          title="Campaign not found"
          description="It may have been deleted, or the link is out of date."
          action={
            <Button variant="secondary" onClick={() => router.push("/campaigns")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to campaigns
            </Button>
          }
        />
      </Card>
    );
  }

  const publicReplies =
    campaign.publicReplyMessages && campaign.publicReplyMessages.length > 0
      ? campaign.publicReplyMessages
      : campaign.publicReplyMessage
        ? [campaign.publicReplyMessage]
        : [];
  const hasLink = Boolean(campaign.trackedLinks?.[0]?.destinationUrl);
  const hasSecondLink = Boolean(campaign.trackedLinks?.[1]?.destinationUrl);

  const trigger = campaign.matchAnyPost
    ? "Any post or reel"
    : campaign.pendingNextReel
      ? "Your next reel"
      : "A specific post or reel";
  const matchText = campaign.matchAnyWord
    ? "Any comment"
    : campaign.keywords.join(", ") || "No keywords";

  const metrics = [
    { label: "Sends", value: campaign.analytics.sent, icon: Send },
    { label: "Clicks", value: campaign.analytics.clicks, icon: MousePointerClick },
    { label: "CTR", value: `${campaign.analytics.ctr}%`, icon: Percent },
    { label: "Failed", value: campaign.analytics.failed, icon: XCircle },
    // Only a follow-gated campaign can tell who followed because of it.
    ...(campaign.requireFollow
      ? [{ label: "New followers", value: campaign.analytics.newFollowers, icon: UserPlus }]
      : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-8">
      {/* Left: config summary */}
      <div className="space-y-6">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Campaigns
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground">
            {campaign.name}
          </h1>
          <Badge tone={campaign.isActive ? "success" : "neutral"}>
            {campaign.isActive ? "LIVE" : "Paused"}
          </Badge>
        </div>

        <Summary title="When someone comments on">
          <div className="flex items-center gap-3">
            {postThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postThumb}
                alt="Post"
                className="h-14 w-14 rounded-xl border border-border object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-xl bg-surface-2 text-[10px] text-muted">
                {campaign.matchAnyPost || campaign.pendingNextReel ? "Any" : "Post"}
              </div>
            )}
            <span className="text-sm text-foreground">{trigger}</span>
          </div>
        </Summary>

        <Summary title="And this comment has">
          <FieldBox>{matchText}</FieldBox>
          {campaign.dmTriggerEnabled && (
            <p className="text-xs text-muted">
              Also replies when someone DMs{" "}
              {campaign.matchAnyWord ? "anything" : "these words"}.
            </p>
          )}
          {publicReplies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Public reply under the post</p>
              {publicReplies.map((m, i) => (
                <FieldBox key={i}>{m}</FieldBox>
              ))}
            </div>
          )}
        </Summary>

        {campaign.openingDmEnabled && (
          <Summary title="They will get an opening DM" editHref={`/campaigns/${campaign.id}/edit`}>
            <FieldBox>{campaign.openingDmMessage || CAMPAIGN_DEFAULTS.openingDmMessage}</FieldBox>
            <FieldBox>{campaign.openingDmButtonLabel || CAMPAIGN_DEFAULTS.openingDmButtonLabel}</FieldBox>
          </Summary>
        )}

        {campaign.requireFollow && (
          <Summary title="They must follow first" editHref={`/campaigns/${campaign.id}/edit`}>
            <FieldBox>
              {campaign.followPromptMessage || CAMPAIGN_DEFAULTS.followPromptMessage}
            </FieldBox>
            <FieldBox>
              {campaign.followPromptButtonLabel ||
                CAMPAIGN_DEFAULTS.followPromptButtonLabel}
            </FieldBox>
          </Summary>
        )}

        <Summary title="And then, they will get a DM" editHref={`/campaigns/${campaign.id}/edit`}>
          <FieldBox>{campaign.dmMessage}</FieldBox>
          {hasLink && (
            <FieldBox>{campaign.linkButtonLabel || CAMPAIGN_DEFAULTS.linkButtonLabel}</FieldBox>
          )}
          {hasSecondLink && (
            <FieldBox>
              {campaign.trackedLinks?.[1]?.label ||
                CAMPAIGN_DEFAULTS.secondaryButtonLabel}
            </FieldBox>
          )}
        </Summary>

        {hasLink && (
          <Summary title="The exact link sent">
            {campaign.trackedLinks
              ?.filter((link) => link.destinationUrl)
              .map((link, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
                    <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                    <p className="select-all break-all font-mono text-xs text-foreground">
                      {link.trackedUrl ?? link.destinationUrl}
                    </p>
                  </div>
                  <p className="text-xs text-muted">
                    {link.label ? `${link.label} · ` : ""}redirects to{" "}
                    <span className="break-all">{link.destinationUrl}</span>
                  </p>
                </div>
              ))}
          </Summary>
        )}

        {campaign.followUpEnabled && campaign.followUpMessage && (
          <Summary title="Then a follow-up message">
            <FieldBox>{campaign.followUpMessage}</FieldBox>
            <p className="text-xs text-muted">
              {campaign.followUpDelayMinutes && campaign.followUpDelayMinutes > 0
                ? `Sent ${campaign.followUpDelayMinutes} min after the link.`
                : "Sent right after the link."}
            </p>
          </Summary>
        )}
      </div>

      {/* Right: top bar + tabs */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-border pb-4">
          <div className="inline-flex shrink-0 rounded-full bg-surface-2 p-1">
            <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
              Insights
            </TabButton>
            <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
              Preview
            </TabButton>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href={`/campaigns/${campaign.id}/edit`} variant="secondary" size="sm">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </ButtonLink>
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleActive}
              disabled={busy}
              className={
                campaign.isActive
                  ? "border-error/30 text-error hover:border-error/30 hover:bg-error/10"
                  : "border-success/30 text-success hover:border-success/30 hover:bg-success/10"
              }
            >
              {campaign.isActive ? (
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {campaign.isActive ? "Stop" : "Resume"}
            </Button>
          </div>
        </div>

        {tab === "insights" && (
          <div
            className={cn(
              "grid grid-cols-2 gap-4",
              metrics.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"
            )}
          >
            {metrics.map((m) => (
              <StatCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
            ))}
          </div>
        )}

        {tab === "preview" && (
          <div className="flex justify-center sm:justify-start">
          <CampaignPreview
            tab={previewTab}
            onTabChange={setPreviewTab}
            username={campaign.instagramAccount.username}
            avatarUrl={avatarUrl}
            postThumb={postThumb}
            caption=""
            sampleComment={campaign.matchAnyWord ? "nice!" : campaign.keywords[0] ?? "LINK"}
            dmTriggerEnabled={campaign.dmTriggerEnabled}
            publicReplyEnabled={campaign.publicReplyEnabled}
            publicReplyMessage={publicReplies[0] ?? ""}
            openingDmEnabled={campaign.openingDmEnabled}
            openingDmMessage={campaign.openingDmMessage ?? ""}
            openingDmButtonLabel={campaign.openingDmButtonLabel ?? ""}
            revealMessage={campaign.dmMessage}
            hasLink={hasLink}
            linkButtonLabel={campaign.linkButtonLabel || CAMPAIGN_DEFAULTS.linkButtonLabel}
            linkUrl={
              campaign.trackedLinks?.[0]?.trackedUrl ??
              campaign.trackedLinks?.[0]?.destinationUrl
            }
            hasSecondLink={hasSecondLink}
            secondLinkButtonLabel={
              campaign.trackedLinks?.[1]?.label || CAMPAIGN_DEFAULTS.secondaryButtonLabel
            }
            requireFollow={campaign.requireFollow}
            followPromptMessage={campaign.followPromptMessage ?? ""}
            followPromptButtonLabel={
              campaign.followPromptButtonLabel || CAMPAIGN_DEFAULTS.followPromptButtonLabel
            }
            followUpEnabled={campaign.followUpEnabled ?? false}
            followUpMessage={campaign.followUpMessage ?? ""}
            followUpDelayMinutes={campaign.followUpDelayMinutes ?? 0}
          />
          </div>
        )}
      </div>
    </div>
  );
}

function Summary({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {editHref && (
          <Link
            href={editHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            Edit
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground">
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "bg-surface text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
