"use client";

/**
 * Campaigns List Page
 *
 * Shows all campaigns as cards with toggle and delete.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Megaphone,
  MoreVertical,
  MousePointerClick,
  Percent,
  Plus,
  Search,
  SearchX,
  Send,
  Upload,
} from "lucide-react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import { readCache, writeCache } from "@/lib/client-cache";
import { cn } from "@/lib/cn";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Toggle,
} from "@/components/ui";

interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  postId: string | null;
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage: string | null;
  publicReplyMessages: string[];
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  isActive: boolean;
  wholeWordMatch: boolean;
  instagramAccountId: string;
  instagramAccount: {
    username: string;
    instagramId: string;
  };
  reportShareSlug: string | null;
  reportShareEnabled: boolean;
  reportUrl: string | null;
  createdAt: string;
  _count: { dmLogs: number };
  trackedLinks: Array<{
    id: string;
    slug: string;
    label: string | null;
    destinationUrl: string;
    trackedUrl: string;
    _count: { clicks: number };
  }>;
  analytics: {
    sent: number;
    skipped: number;
    failed: number;
    clicks: number;
    ctr: number;
    topKeywords: { keyword: string; count: number }[];
  };
}

export default function CampaignsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [loading, setLoading] = useState(true);
  // postId -> current thumbnail URL, fetched live (Instagram URLs expire, so
  // they are never stored on the campaign).
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  // postId -> video URL for reels, so a campaign thumbnail can play on click.
  const [videos, setVideos] = useState<Record<string, string>>({});
  // The reel currently playing in the lightbox (null when closed).
  const [playingVideo, setPlayingVideo] = useState<{
    url: string;
    postUrl: string | null;
  } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">(
    "all"
  );

  const fetchAutomations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAccountId !== "all") {
        params.set("instagramAccountId", selectedAccountId);
      }
      const res = await fetch(
        `/api/automations${params.size ? `?${params}` : ""}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data.success) setAutomations(data.data);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setAccounts(payload.data.instagramAccounts ?? []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAutomations();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchAutomations]);

  // Fetch fresh post thumbnails (and reel video URLs) for the accounts in view
  // and map them by postId. Cache-first so they show instantly on a return
  // visit. Instagram URLs expire, so they are never stored on the campaign.
  useEffect(() => {
    if (automations.length === 0) return;
    let cancelled = false;
    const accountIds = Array.from(
      new Set(automations.map((a) => a.instagramAccountId))
    ).sort();
    const cacheKey = `ig-media:${accountIds.join(",")}`;

    const cached = readCache<{
      thumbs: Record<string, string>;
      videos: Record<string, string>;
    }>(cacheKey, 15 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (cached.data) {
      setThumbnails(cached.data.thumbs);
      setVideos(cached.data.videos);
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    Promise.all(
      accountIds.map((accountId) =>
        fetch(`/api/instagram/posts?instagramAccountId=${accountId}&limit=50`)
          .then((res) => res.json())
          .then((payload) =>
            payload.success
              ? (payload.data as {
                  id: string;
                  media_type?: string;
                  media_url?: string;
                  thumbnail_url?: string;
                }[])
              : []
          )
          .catch(() => [])
      )
    ).then((lists) => {
      if (cancelled) return;
      const thumbs: Record<string, string> = {};
      const vids: Record<string, string> = {};
      for (const list of lists) {
        for (const media of list) {
          const url = media.thumbnail_url ?? media.media_url;
          if (url) thumbs[media.id] = url;
          if (media.media_type === "VIDEO" && media.media_url) {
            vids[media.id] = media.media_url;
          }
        }
      }
      setThumbnails(thumbs);
      setVideos(vids);
      writeCache(cacheKey, { thumbs, videos: vids });
    });

    return () => {
      cancelled = true;
    };
  }, [automations]);

  // Close the reel lightbox on Escape.
  useEffect(() => {
    if (!playingVideo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayingVideo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playingVideo]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await fetch(`/api/automations?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isActive: !isActive } : a))
      );
    } catch (err) {
      console.error("Failed to toggle:", err);
    }
  }

  async function copyReelUrl(auto: Campaign) {
    setMenuOpenId(null);
    if (!auto.postUrl) return;
    try {
      await navigator.clipboard.writeText(auto.postUrl);
      setCopiedId(auto.id);
      window.setTimeout(
        () => setCopiedId((cur) => (cur === auto.id ? null : cur)),
        1500
      );
    } catch (err) {
      console.error("Failed to copy reel URL:", err);
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    try {
      await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  }

  async function duplicateAutomation(auto: Campaign) {
    setMenuOpenId(null);
    const specific = !auto.matchAnyPost && !auto.pendingNextReel;
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${auto.name} copy`,
          instagramAccountId: auto.instagramAccountId,
          postId: specific ? auto.postId : null,
          postUrl: specific ? auto.postUrl : null,
          matchAnyPost: auto.matchAnyPost,
          pendingNextReel: auto.pendingNextReel,
          matchAnyWord: auto.matchAnyWord,
          keywords: auto.keywords,
          dmMessage: auto.dmMessage,
          openingDmEnabled: auto.openingDmEnabled,
          openingDmMessage: auto.openingDmMessage,
          openingDmButtonLabel: auto.openingDmButtonLabel,
          publicReplyEnabled: auto.publicReplyEnabled,
          publicReplyMessages: auto.publicReplyMessages,
          trackedDestinationUrl: auto.trackedLinks[0]?.destinationUrl ?? "",
          secondaryDestinationUrl: auto.trackedLinks[1]?.destinationUrl ?? "",
          secondaryButtonLabel: auto.trackedLinks[1]?.label ?? "Open link",
          requireFollow: auto.requireFollow,
          followPromptMessage: auto.followPromptMessage,
          followPromptButtonLabel: auto.followPromptButtonLabel,
          wholeWordMatch: auto.wholeWordMatch,
          isActive: false,
        }),
      });
      const data = await res.json();
      if (data.success) void fetchAutomations();
      else console.error("Duplicate failed:", data.error);
    } catch (err) {
      console.error("Failed to duplicate:", err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="panel h-36 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const filtered = automations.filter((a) => {
    if (statusFilter === "active" && !a.isActive) return false;
    if (statusFilter === "paused" && a.isActive) return false;
    if (!query) return true;
    return (
      a.name.toLowerCase().includes(query) ||
      a.keywords.some((k) => k.toLowerCase().includes(query)) ||
      a.dmMessage.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Campaigns"
        description={`${filtered.length}${
          filtered.length !== automations.length
            ? ` of ${automations.length}`
            : ""
        } campaign${automations.length !== 1 ? "s" : ""}`}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {accounts.length > 1 && (
              <AccountSelect
                accounts={accounts}
                value={selectedAccountId}
                onChange={handleAccountChange}
              />
            )}
            <ButtonLink href="/campaigns/import" variant="secondary">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import
            </ButtonLink>
            <ButtonLink href="/campaigns/new" variant="primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New campaign
            </ButtonLink>
          </div>
        }
      />

      {/* Search + status filter */}
      {automations.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns by name, keyword, or message…"
              className="pl-10"
            />
          </div>
          <div className="inline-flex shrink-0 rounded-full bg-surface-2 p-1">
            {(["all", "active", "paused"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors",
                  statusFilter === s
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {automations.length === 0 && (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first comment-to-DM campaign to turn a post or reel into a measurable conversation flow."
            action={
              <ButtonLink href="/campaigns/new" variant="primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create campaign
              </ButtonLink>
            }
          />
        </Card>
      )}

      {/* No matches for the current filter */}
      {automations.length > 0 && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No campaigns match your search"
            description="Try a different name, keyword, or status filter."
          />
        </Card>
      )}

      {/* Campaign cards */}
      <div className="space-y-3">
        {filtered.map((auto) => {
          const videoUrl = auto.postId ? videos[auto.postId] : undefined;
          return (
            <Card
              key={auto.id}
              onClick={() => router.push(`/campaigns/${auto.id}`)}
              className="cursor-pointer transition-colors hover:border-border-hover"
            >
              {/* Wraps rather than compressing: on a phone the action buttons drop
                  to their own line instead of squeezing the campaign summary. */}
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                {auto.postId &&
                  thumbnails[auto.postId] &&
                  (videoUrl ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingVideo({ url: videoUrl, postUrl: auto.postUrl });
                      }}
                      aria-label="Play reel preview"
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnails[auto.postId]}
                        alt="Campaign reel"
                        className="h-12 w-12 rounded-xl border border-border object-cover hover:border-border-hover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </button>
                  ) : (
                    <a
                      href={auto.postUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbnails[auto.postId]}
                        alt="Campaign post"
                        className="h-12 w-12 rounded-xl border border-border object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </a>
                  ))}
                <div className="min-w-[12rem] flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">{auto.name}</h3>
                    <Badge tone="neutral">@{auto.instagramAccount.username}</Badge>
                    <Badge tone={auto.isActive ? "success" : "neutral"}>
                      {auto.isActive ? "LIVE" : "Paused"}
                    </Badge>
                    {auto.pendingNextReel && (
                      <Badge tone="warning">Waiting for next reel</Badge>
                    )}
                    {auto.requireFollow && <Badge tone="accent">Follow gate</Badge>}
                    {auto.trackedLinks.length >= 2 && (
                      <Badge tone="accent">2 links</Badge>
                    )}
                  </div>

                  {/* Keywords */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {auto.keywords.map((kw) => (
                      <Badge key={kw} tone="accent">
                        {kw}
                      </Badge>
                    ))}
                  </div>

                  {/* DM preview */}
                  <p className="truncate text-sm text-muted">
                    &ldquo;{auto.dmMessage}&rdquo;
                  </p>

                  {/* Tracked link sent */}
                  {auto.trackedLinks[0]?.trackedUrl && (
                    <p className="mt-2 truncate font-mono text-xs text-muted">
                      {auto.trackedLinks[0].trackedUrl}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      {auto._count.dmLogs} runs
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <Percent className="h-3.5 w-3.5" aria-hidden="true" />
                      {auto.analytics.ctr}% CTR
                    </span>
                    <span>{auto.analytics.sent} sent</span>
                    <span>{auto.analytics.skipped} skipped</span>
                    <span>{auto.analytics.failed} failed</span>
                    <span className="inline-flex items-center gap-1.5">
                      <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />
                      {auto.analytics.clicks} clicks
                    </span>
                  </div>

                  {auto.analytics.topKeywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {auto.analytics.topKeywords.map((keyword) => (
                        <span
                          key={keyword.keyword}
                          className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-muted"
                        >
                          {keyword.keyword}: {keyword.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div
                  className="ml-auto flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Copy reel URL */}
                  {auto.postUrl && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyReelUrl(auto)}
                    >
                      {copiedId === auto.id ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copiedId === auto.id ? "Copied!" : "Copy URL"}
                    </Button>
                  )}
                  {/* Toggle */}
                  <Toggle
                    checked={auto.isActive}
                    onChange={() => toggleActive(auto.id, auto.isActive)}
                    aria-label={`${auto.isActive ? "Pause" : "Activate"} ${auto.name}`}
                  />

                  {/* Kebab menu */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setMenuOpenId((cur) => (cur === auto.id ? null : auto.id))
                      }
                      aria-label="More actions"
                      className="px-2"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {menuOpenId === auto.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpenId(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
                          <button
                            onClick={() => void duplicateAutomation(auto)}
                            className="block w-full px-3.5 py-2.5 text-left text-sm text-foreground hover:bg-surface-hover"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={() => {
                              setMenuOpenId(null);
                              void deleteAutomation(auto.id);
                            }}
                            className="block w-full px-3.5 py-2.5 text-left text-sm text-error hover:bg-surface-hover"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Reel lightbox */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="relative flex max-w-full flex-col items-end gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 text-sm">
              {playingVideo.postUrl && (
                <a
                  href={playingVideo.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-white/80 hover:text-white"
                >
                  Open on Instagram
                </a>
              )}
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                className="font-medium text-white/80 hover:text-white"
              >
                Close
              </button>
            </div>
            <video
              src={playingVideo.url}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[80vh] max-w-full rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
