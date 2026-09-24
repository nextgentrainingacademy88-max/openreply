"use client";

/**
 * Campaign Builder
 *
 * Two-pane campaign editor: a numbered flow of steps on the left and a live
 * phone preview on the right. Used for both creating and editing a campaign.
 *
 * Turn 1 wires the fully-functional pieces: trigger scope (specific / any /
 * next post), match mode (specific words / any word), the opening + reveal DM
 * text, public reply, and the tracked link. Button-driven delivery and the
 * follow / email / follow-up steps arrive in later turns.
 */

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Zap,
  MessageSquareReply,
  Send,
  UserPlus,
  Link2,
  Clock,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import PostPicker from "@/components/post-picker";
import CampaignPreview, { type PreviewTab } from "@/components/campaign-preview";
import { readCache, writeCache } from "@/lib/client-cache";
import { CAMPAIGN_DEFAULTS } from "@/lib/automations/defaults";
import { cn } from "@/lib/cn";
import {
  IMPORT_QUEUE_KEY,
  IMPORT_ACCOUNT_KEY,
  type ImportRow,
} from "@/lib/import-queue";
import { Button, Badge, Card, CardTitle, Input, Textarea, Toggle } from "@/components/ui";

type TriggerScope = "specific" | "any" | "next";
type MatchMode = "specific" | "any";

interface LoadedCampaign {
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
  trackedLinks?: { destinationUrl: string; label?: string | null }[];
}

interface CampaignBuilderProps {
  mode: "new" | "edit";
  campaignId?: string;
}

/** A single choice in a Radio group — rounded, bordered, orange when picked. */
function Radio({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
        checked
          ? "border-accent bg-accent-soft"
          : "border-border hover:border-border-hover"
      )}
    >
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
          checked ? "border-accent" : "border-border-hover"
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
      </span>
      <span className="flex-1 text-foreground">{children}</span>
    </button>
  );
}

/** Shows only once the field has drifted from the owner's default wording. */
function ResetToDefault({
  value,
  defaultValue,
  onReset,
}: {
  value: string;
  defaultValue: string;
  onReset: () => void;
}) {
  if (value === defaultValue) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className="text-xs font-semibold text-accent hover:underline"
    >
      Reset to my default
    </button>
  );
}

/** The numbered, iconed circle at the head of each flow step. */
function FlowStepIcon({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <div
      className={cn(
        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background transition-colors",
        active ? "border-accent text-accent" : "border-border text-muted"
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

/**
 * One card in the campaign flow: a numbered/iconed circle connected to the
 * next step by a vertical line, a title + helper line, an optional toggle in
 * the header (for steps that can be switched off), and body content.
 */
function FlowStep({
  number,
  icon,
  title,
  helper,
  active = true,
  toggle,
  children,
}: {
  number: number;
  icon: LucideIcon;
  title: string;
  helper: string;
  active?: boolean;
  toggle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-4">
      <FlowStepIcon icon={icon} active={active} />
      <Card className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-bold tracking-wide text-muted">
              STEP {number}
            </span>
            <CardTitle className="mt-0.5">{title}</CardTitle>
            <p className="mt-1 text-xs text-muted">{helper}</p>
          </div>
          {toggle && <div className="shrink-0 pt-0.5">{toggle}</div>}
        </div>
        {children && <div className="mt-4 space-y-3">{children}</div>}
      </Card>
    </div>
  );
}

export default function CampaignBuilder({ mode, campaignId }: CampaignBuilderProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(mode === "edit");
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [triggerScope, setTriggerScope] = useState<TriggerScope>("specific");
  const [postId, setPostId] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState<string | null>(null);
  const [postThumb, setPostThumb] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");

  // Post IDs already tied to another automation on this account, so the picker
  // can flag them and the user knows not to double-assign. Maps postId ->
  // the campaign name using it (for the tooltip).
  const [usedPosts, setUsedPosts] = useState<Record<string, string>>({});

  const [matchMode, setMatchMode] = useState<MatchMode>("specific");
  const [keywordText, setKeywordText] = useState("");
  const [dmTriggerEnabled, setDmTriggerEnabled] = useState(false);

  const [publicReplyEnabled, setPublicReplyEnabled] = useState(false);
  const [publicReplyMessages, setPublicReplyMessages] = useState<string[]>([
    ...CAMPAIGN_DEFAULTS.publicReplyMessages,
  ]);

  const [openingDmEnabled, setOpeningDmEnabled] = useState(false);
  const [openingDmMessage, setOpeningDmMessage] = useState<string>(
    CAMPAIGN_DEFAULTS.openingDmMessage
  );
  const [openingDmButtonLabel, setOpeningDmButtonLabel] = useState<string>(
    CAMPAIGN_DEFAULTS.openingDmButtonLabel
  );

  const [dmMessage, setDmMessage] = useState<string>(CAMPAIGN_DEFAULTS.dmMessage);
  const [linkOpen, setLinkOpen] = useState(false);
  const [trackedDestinationUrl, setTrackedDestinationUrl] = useState("");
  const [linkButtonLabel, setLinkButtonLabel] = useState<string>(
    CAMPAIGN_DEFAULTS.linkButtonLabel
  );
  const [secondLinkOpen, setSecondLinkOpen] = useState(false);
  const [secondaryDestinationUrl, setSecondaryDestinationUrl] = useState("");
  const [secondaryButtonLabel, setSecondaryButtonLabel] = useState<string>(
    CAMPAIGN_DEFAULTS.secondaryButtonLabel
  );
  const [requireFollow, setRequireFollow] = useState(false);
  const [followPromptMessage, setFollowPromptMessage] = useState<string>(
    CAMPAIGN_DEFAULTS.followPromptMessage
  );
  const [followPromptButtonLabel, setFollowPromptButtonLabel] =
    useState<string>(CAMPAIGN_DEFAULTS.followPromptButtonLabel);
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState<string>(
    CAMPAIGN_DEFAULTS.followUpMessage
  );
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(0);

  const [previewTab, setPreviewTab] = useState<PreviewTab>("dm");

  // CSV import queue. When present, each save advances to the next row instead
  // of returning to the campaigns list.
  const [importQueue, setImportQueue] = useState<ImportRow[] | null>(null);
  const [importTotal, setImportTotal] = useState(0);

  const keywords = useMemo(
    () =>
      keywordText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    [keywordText]
  );

  // Fetch the connected account's real avatar for the preview (cache-first so
  // it shows instantly on a return visit instead of a blank circle).
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    const cacheKey = `ig-avatar:${selectedAccountId}`;
    const cached = readCache<string | null>(cacheKey, 30 * 60 * 1000);
    // Hydrating state from cache is a legitimate effect use here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached.data !== null) setAvatarUrl(cached.data);

    const params = new URLSearchParams({ instagramAccountId: selectedAccountId });
    fetch(`/api/instagram/profile?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const url = d.success ? d.data.profilePictureUrl ?? null : null;
        setAvatarUrl(url);
        writeCache(cacheKey, url);
      })
      .catch(() => {
        if (!cancelled && cached.data === null) setAvatarUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  // Load accounts (both modes need them for the preview username + selector).
  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return;
        const next: AccountOption[] = payload.data.instagramAccounts ?? [];
        setAccounts(next);
        setSelectedAccountId(
          (prev) => prev || payload.data.selectedInstagramAccountId || next[0]?.id || ""
        );
      })
      .catch(() => setAccounts([]));
  }, []);

  // Prefill when editing.
  useEffect(() => {
    if (mode !== "edit" || !campaignId) return;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (!payload.success) return setNotFound(true);
        const c = (payload.data as LoadedCampaign[]).find((x) => x.id === campaignId);
        if (!c) return setNotFound(true);
        setName(c.name);
        setSelectedAccountId(c.instagramAccountId);
        setTriggerScope(
          c.matchAnyPost ? "any" : c.pendingNextReel ? "next" : "specific"
        );
        setPostId(c.postId);
        setPostUrl(c.postUrl);
        setMatchMode(c.matchAnyWord ? "any" : "specific");
        setKeywordText(c.keywords.join(", "));
        setDmTriggerEnabled(c.dmTriggerEnabled ?? false);
        setPublicReplyEnabled(c.publicReplyEnabled);
        setPublicReplyMessages(
          c.publicReplyMessages?.length
            ? c.publicReplyMessages
            : c.publicReplyMessage
              ? [c.publicReplyMessage]
              : [...CAMPAIGN_DEFAULTS.publicReplyMessages]
        );
        setOpeningDmEnabled(c.openingDmEnabled);
        setOpeningDmMessage(c.openingDmMessage || CAMPAIGN_DEFAULTS.openingDmMessage);
        setOpeningDmButtonLabel(
          c.openingDmButtonLabel || CAMPAIGN_DEFAULTS.openingDmButtonLabel
        );
        setDmMessage(c.dmMessage);
        setLinkButtonLabel(c.linkButtonLabel || CAMPAIGN_DEFAULTS.linkButtonLabel);
        setIsActive(c.isActive);
        const link = c.trackedLinks?.[0]?.destinationUrl ?? "";
        setTrackedDestinationUrl(link);
        setLinkOpen(Boolean(link));
        const secondLink = c.trackedLinks?.[1];
        setSecondaryDestinationUrl(secondLink?.destinationUrl ?? "");
        setSecondaryButtonLabel(secondLink?.label || CAMPAIGN_DEFAULTS.secondaryButtonLabel);
        setSecondLinkOpen(Boolean(secondLink?.destinationUrl));
        setRequireFollow(c.requireFollow ?? false);
        setFollowPromptMessage(c.followPromptMessage || CAMPAIGN_DEFAULTS.followPromptMessage);
        setFollowPromptButtonLabel(
          c.followPromptButtonLabel || CAMPAIGN_DEFAULTS.followPromptButtonLabel
        );
        setFollowUpEnabled(c.followUpEnabled ?? false);
        setFollowUpMessage(c.followUpMessage || CAMPAIGN_DEFAULTS.followUpMessage);
        setFollowUpDelayMinutes(c.followUpDelayMinutes ?? 0);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [mode, campaignId]);

  // Track which posts on the selected account are already assigned to an
  // automation, so the picker can highlight them. The campaign being edited is
  // excluded — its own post should read as selected, not "taken".
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    fetch("/api/automations", { cache: "no-store" })
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled || !payload.success) return;
        const map: Record<string, string> = {};
        for (const a of payload.data as LoadedCampaign[]) {
          if (!a.postId) continue;
          if (a.instagramAccountId !== selectedAccountId) continue;
          if (mode === "edit" && a.id === campaignId) continue;
          map[a.postId] = a.name;
        }
        setUsedPosts(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, mode, campaignId]);

  // Prefill the editable fields from one queued import row. The reel is left
  // unset so the user picks it per row.
  function prefillFromRow(row: ImportRow) {
    setName(row.name ?? "");
    setTriggerScope("specific");
    setPostId(null);
    setPostUrl(null);
    setPostThumb(null);
    setPostCaption("");
    setMatchMode("specific");
    setKeywordText((row.keywords ?? []).join(", "));
    setDmMessage(row.dmMessage ?? "");
    setPublicReplyEnabled(Boolean(row.publicReply));
    setPublicReplyMessages(row.publicReply ? [row.publicReply] : [""]);
    const hasOpening = Boolean(row.openingDmMessage);
    setOpeningDmEnabled(hasOpening);
    setOpeningDmMessage(row.openingDmMessage ?? "");
    setOpeningDmButtonLabel(
      row.openingDmButtonLabel || (hasOpening ? "Send link" : "")
    );
    const link = row.trackedUrl ?? "";
    setTrackedDestinationUrl(link);
    setLinkOpen(Boolean(link));
    setError(null);
  }

  // Pick up a staged CSV import (new mode only) and prefill the first row.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "new") return;
    try {
      const raw = window.localStorage.getItem(IMPORT_QUEUE_KEY);
      const acct = window.localStorage.getItem(IMPORT_ACCOUNT_KEY);
      if (!raw) return;
      const queue = JSON.parse(raw) as ImportRow[];
      if (!Array.isArray(queue) || queue.length === 0) return;
      setImportQueue(queue);
      setImportTotal(queue.length);
      if (acct) setSelectedAccountId(acct);
      prefillFromRow(queue[0]);
    } catch {
      // ignore a malformed queue
    }
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const username =
    accounts.find((a) => a.id === selectedAccountId)?.username ?? "yourbrand";

  function handlePostSelect(
    id: string,
    url?: string,
    thumb?: string,
    caption?: string
  ) {
    setPostId(id);
    setPostUrl(url ?? null);
    setPostThumb(thumb ?? null);
    setPostCaption(caption ?? "");
  }

  function ensureLinkToken() {
    setDmMessage((cur) => (cur.includes("{link}") ? cur : `${cur.trim()} {link}`.trim()));
  }

  async function handleSubmit(activeValue: boolean) {
    setError(null);

    if (!selectedAccountId) return setError("Connect an Instagram account first.");
    if (triggerScope === "specific" && !postId)
      return setError("Pick a post or reel to trigger the campaign.");
    if (matchMode === "specific" && keywords.length === 0)
      return setError("Add at least one keyword, or switch to any word.");
    if (!dmMessage.trim()) return setError("Add the DM with the link.");
    if (openingDmEnabled && (!openingDmMessage.trim() || !openingDmButtonLabel.trim()))
      return setError("Your opening DM needs a message and a button label.");

    setSaving(true);

    const payload = {
      name: name.trim() || `Campaign for @${username}`,
      instagramAccountId: selectedAccountId,
      postId: triggerScope === "specific" ? postId : null,
      postUrl: triggerScope === "specific" ? postUrl : null,
      matchAnyPost: triggerScope === "any",
      pendingNextReel: triggerScope === "next",
      matchAnyWord: matchMode === "any",
      keywords: matchMode === "any" ? [] : keywords,
      dmTriggerEnabled,
      dmMessage,
      openingDmEnabled,
      openingDmMessage: openingDmEnabled ? openingDmMessage : null,
      openingDmButtonLabel: openingDmEnabled ? openingDmButtonLabel : null,
      publicReplyEnabled,
      publicReplyMessages: publicReplyEnabled
        ? publicReplyMessages.map((m) => m.trim()).filter(Boolean)
        : [],
      trackedDestinationUrl: trackedDestinationUrl.trim() || "",
      linkButtonLabel: linkButtonLabel.trim() || CAMPAIGN_DEFAULTS.linkButtonLabel,
      secondaryDestinationUrl: secondaryDestinationUrl.trim() || "",
      secondaryButtonLabel:
        secondaryButtonLabel.trim() || CAMPAIGN_DEFAULTS.secondaryButtonLabel,
      requireFollow,
      followPromptMessage: requireFollow
        ? followPromptMessage.trim() || CAMPAIGN_DEFAULTS.followPromptMessage
        : "",
      followPromptButtonLabel: requireFollow
        ? followPromptButtonLabel.trim() || CAMPAIGN_DEFAULTS.followPromptButtonLabel
        : "",
      followUpEnabled,
      followUpMessage: followUpEnabled
        ? followUpMessage.trim() || CAMPAIGN_DEFAULTS.followUpMessage
        : "",
      followUpDelayMinutes: followUpEnabled ? followUpDelayMinutes : 0,
      isActive: activeValue,
    };

    try {
      const res =
        mode === "new"
          ? await fetch("/api/automations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/automations?id=${campaignId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json();
      if (data.success) {
        // The post we just assigned is now in use. Reflect it immediately so
        // the picker flags it on the next imported row — the fetch that builds
        // this map doesn't re-run while the builder stays mounted through the
        // import queue.
        if (triggerScope === "specific" && postId) {
          const assignedPostId = postId;
          setUsedPosts((prev) => ({ ...prev, [assignedPostId]: payload.name }));
        }
        // Importing: advance to the next queued row instead of leaving.
        if (importQueue && importQueue.length > 1) {
          const remaining = importQueue.slice(1);
          try {
            window.localStorage.setItem(
              IMPORT_QUEUE_KEY,
              JSON.stringify(remaining)
            );
          } catch {
            // ignore
          }
          setImportQueue(remaining);
          prefillFromRow(remaining[0]);
          setSaving(false);
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          return;
        }
        if (importQueue) {
          try {
            window.localStorage.removeItem(IMPORT_QUEUE_KEY);
            window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
          } catch {
            // ignore
          }
        }
        // refresh() busts the router cache so the list reflects the save
        // instead of landing on a stale (empty) campaigns page.
        router.push("/campaigns");
        router.refresh();
      } else {
        // Surface the specific field that failed validation instead of a
        // generic "Invalid input".
        const fieldErrors = data.details?.fieldErrors as
          | Record<string, string[]>
          | undefined;
        const firstField = fieldErrors && Object.keys(fieldErrors)[0];
        setError(
          firstField
            ? `${firstField}: ${fieldErrors[firstField][0]}`
            : data.error ?? "Failed to save campaign"
        );
        if (typeof window !== "undefined")
          window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setError("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  }

  // Skip the current imported row without saving a campaign for it, advancing
  // to the next one (or finishing the import if it was the last).
  function skipRow() {
    if (!importQueue) return;
    setError(null);
    if (importQueue.length > 1) {
      const remaining = importQueue.slice(1);
      try {
        window.localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(remaining));
      } catch {
        // ignore
      }
      setImportQueue(remaining);
      prefillFromRow(remaining[0]);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
      return;
    }
    // Last row skipped — finish the import.
    try {
      window.localStorage.removeItem(IMPORT_QUEUE_KEY);
      window.localStorage.removeItem(IMPORT_ACCOUNT_KEY);
    } catch {
      // ignore
    }
    router.push("/campaigns");
    router.refresh();
  }

  if (loading) {
    return <div className="panel h-64 rounded-2xl animate-pulse" />;
  }

  if (notFound) {
    return (
      <div className="panel rounded-2xl p-8 text-center">
        <p className="text-sm text-muted">Campaign not found.</p>
        <Button
          variant="secondary"
          onClick={() => router.push("/campaigns")}
          className="mt-4"
        >
          Back to campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {importQueue && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
          <span className="font-semibold text-foreground">
            Importing {importTotal - importQueue.length + 1} of {importTotal}.
          </span>{" "}
          <span className="text-muted">
            Fields are prefilled from your CSV. Pick the reel, edit anything, and
            save to load the next one — or Skip if you don&rsquo;t want this one.
          </span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          {mode === "edit" ? (
            <>
              <span className="truncate text-sm font-semibold text-foreground">
                {name || "Untitled campaign"}
              </span>
              <Badge tone={isActive ? "success" : "neutral"}>
                {isActive ? "LIVE" : "PAUSED"}
              </Badge>
            </>
          ) : (
            <span className="text-sm text-muted">New campaign</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {importQueue && (
            <Button variant="secondary" onClick={skipRow} disabled={saving}>
              {importQueue.length > 1 ? "Skip" : "Skip & finish"}
            </Button>
          )}
          {mode === "edit" &&
            (isActive ? (
              <Button
                variant="secondary"
                onClick={() => handleSubmit(false)}
                disabled={saving}
              >
                Stop
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => handleSubmit(true)}
                disabled={saving}
              >
                Go Live
              </Button>
            ))}
          <Button onClick={() => handleSubmit(mode === "new" ? true : isActive)} disabled={saving}>
            {saving ? "Saving…" : mode === "new" ? "Go Live" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* min-w-0 on the cells: a grid item defaults to min-width:auto, so a
          long string widens the whole page instead of wrapping. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:gap-8">
      {/* Left: the flow */}
      <div className="min-w-0 space-y-5">
        {error && (
          <div className="rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
            {error}
          </div>
        )}

        <Card>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Campaign name{" "}
              <span className="font-normal text-muted">(optional)</span>
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YC referral"
              maxLength={100}
            />
          </label>
          {accounts.length > 1 && (
            <div className="mt-3">
              <AccountSelect
                accounts={accounts}
                value={selectedAccountId}
                onChange={(id) => {
                  setSelectedAccountId(id);
                  setPostId(null);
                  setPostUrl(null);
                  setPostThumb(null);
                }}
                includeAll={false}
                label="Instagram account"
              />
            </div>
          )}
        </Card>

        {/* The flow: a numbered, connected chain of steps. */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 left-5 top-2 w-px bg-border"
          />
          <div className="space-y-5">
            <FlowStep
              number={1}
              icon={Zap}
              title="Trigger"
              helper="Start when someone comments — or DMs — on your account."
              active
            >
              <div className="space-y-2">
                <Radio
                  checked={triggerScope === "specific"}
                  onSelect={() => setTriggerScope("specific")}
                >
                  a specific post or reel
                </Radio>
                {triggerScope === "specific" && (
                  <div className="rounded-xl border border-border p-2">
                    <PostPicker
                      selectedPostId={postId}
                      instagramAccountId={selectedAccountId}
                      usedPostIds={usedPosts}
                      onSelect={handlePostSelect}
                    />
                  </div>
                )}
                <Radio
                  checked={triggerScope === "any"}
                  onSelect={() => setTriggerScope("any")}
                >
                  any post or reel
                </Radio>
                <Radio
                  checked={triggerScope === "next"}
                  onSelect={() => setTriggerScope("next")}
                >
                  next post or reel
                </Radio>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-semibold text-foreground">
                  And the comment has
                </p>
                <Radio
                  checked={matchMode === "specific"}
                  onSelect={() => setMatchMode("specific")}
                >
                  a specific word or words
                </Radio>
                {matchMode === "specific" && (
                  <div className="space-y-1">
                    <Input
                      value={keywordText}
                      onChange={(e) => setKeywordText(e.target.value)}
                      placeholder="Enter a word or multiple"
                    />
                    <p className="text-xs text-muted">Use commas to separate words</p>
                  </div>
                )}
                <Radio
                  checked={matchMode === "any"}
                  onSelect={() => setMatchMode("any")}
                >
                  any word
                </Radio>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="text-sm text-foreground">
                  also reply when someone DMs{" "}
                  {matchMode === "any" ? "anything" : "these words"}
                </span>
                <Toggle
                  checked={dmTriggerEnabled}
                  onChange={setDmTriggerEnabled}
                  aria-label="Also reply when someone DMs"
                />
              </div>
              {dmTriggerEnabled && (
                <p className="text-xs text-muted">
                  {matchMode === "any"
                    ? "Every DM to this account gets the reply below — use with care."
                    : "A DM containing any of these words gets the same reply, no comment needed."}
                </p>
              )}
            </FlowStep>

            <FlowStep
              number={2}
              icon={MessageSquareReply}
              title="Public reply"
              helper="Reply publicly under their comment, right away."
              active={publicReplyEnabled}
              toggle={
                <Toggle
                  checked={publicReplyEnabled}
                  onChange={setPublicReplyEnabled}
                  aria-label="Enable public reply"
                />
              }
            >
              {publicReplyEnabled && (
                <div className="space-y-2">
                  {publicReplyMessages.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={msg}
                        onChange={(e) =>
                          setPublicReplyMessages((prev) =>
                            prev.map((m, idx) => (idx === i ? e.target.value : m))
                          )
                        }
                        placeholder={CAMPAIGN_DEFAULTS.publicReplyMessages[0]}
                        maxLength={1000}
                      />
                      {publicReplyMessages.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPublicReplyMessages((prev) =>
                              prev.filter((_, idx) => idx !== i)
                            )
                          }
                          className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-error"
                          aria-label="Remove reply"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {publicReplyMessages.length < 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPublicReplyMessages((prev) => [...prev, ""])
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add another reply
                    </button>
                  )}
                  <p className="text-xs text-muted">
                    One is picked at random each time, so replies don&apos;t look
                    identical.
                  </p>
                </div>
              )}
            </FlowStep>

            <FlowStep
              number={3}
              icon={Send}
              title="Opening DM"
              helper="Ask them to tap a button before the link goes out."
              active={openingDmEnabled}
              toggle={
                <Toggle
                  checked={openingDmEnabled}
                  onChange={setOpeningDmEnabled}
                  aria-label="Enable opening DM"
                />
              }
            >
              {openingDmEnabled && (
                <div className="space-y-2">
                  <Textarea
                    value={openingDmMessage}
                    onChange={(e) => setOpeningDmMessage(e.target.value)}
                    placeholder={CAMPAIGN_DEFAULTS.openingDmMessage}
                    rows={3}
                    className="resize-none"
                    maxLength={1000}
                  />
                  <ResetToDefault
                    value={openingDmMessage}
                    defaultValue={CAMPAIGN_DEFAULTS.openingDmMessage}
                    onReset={() => setOpeningDmMessage(CAMPAIGN_DEFAULTS.openingDmMessage)}
                  />
                  <Input
                    value={openingDmButtonLabel}
                    onChange={(e) => setOpeningDmButtonLabel(e.target.value)}
                    placeholder={CAMPAIGN_DEFAULTS.openingDmButtonLabel}
                    maxLength={20}
                  />
                </div>
              )}
            </FlowStep>

            <FlowStep
              number={4}
              icon={UserPlus}
              title="Follow gate"
              helper="Require a follow before the link is sent."
              active={requireFollow}
              toggle={
                <Toggle
                  checked={requireFollow}
                  onChange={setRequireFollow}
                  aria-label="Require follow before sending the link"
                />
              }
            >
              {requireFollow && (
                <div className="space-y-2">
                  <Textarea
                    value={followPromptMessage}
                    onChange={(e) => setFollowPromptMessage(e.target.value)}
                    placeholder={CAMPAIGN_DEFAULTS.followPromptMessage}
                    rows={3}
                    className="resize-none"
                    maxLength={1000}
                  />
                  <ResetToDefault
                    value={followPromptMessage}
                    defaultValue={CAMPAIGN_DEFAULTS.followPromptMessage}
                    onReset={() => setFollowPromptMessage(CAMPAIGN_DEFAULTS.followPromptMessage)}
                  />
                  <Input
                    value={followPromptButtonLabel}
                    onChange={(e) => setFollowPromptButtonLabel(e.target.value)}
                    placeholder={CAMPAIGN_DEFAULTS.followPromptButtonLabel}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted">
                    We send the link only after they tap the button and Instagram
                    confirms the follow. If it can&apos;t be verified, we send it
                    anyway.
                  </p>
                </div>
              )}
            </FlowStep>

            <FlowStep
              number={5}
              icon={Link2}
              title="DM with link"
              helper="The main message — this is what actually gets sent."
              active
            >
              <Textarea
                value={dmMessage}
                onChange={(e) => setDmMessage(e.target.value)}
                placeholder="Write a message"
                rows={3}
                className="resize-none"
                maxLength={1000}
              />
              <ResetToDefault
                value={dmMessage}
                defaultValue={CAMPAIGN_DEFAULTS.dmMessage}
                onReset={() => setDmMessage(CAMPAIGN_DEFAULTS.dmMessage)}
              />
              {linkOpen ? (
                <div className="space-y-2">
                  <Input
                    value={trackedDestinationUrl}
                    onChange={(e) => setTrackedDestinationUrl(e.target.value)}
                    onBlur={ensureLinkToken}
                    placeholder="https://yourlink.com/offer"
                  />
                  <Input
                    value={linkButtonLabel}
                    onChange={(e) => setLinkButtonLabel(e.target.value)}
                    placeholder="Button label (e.g. Open link)"
                    maxLength={20}
                  />
                  {secondLinkOpen ? (
                    <div className="space-y-2 border-t border-border pt-2">
                      <Input
                        value={secondaryDestinationUrl}
                        onChange={(e) => setSecondaryDestinationUrl(e.target.value)}
                        placeholder="https://yourlink.com/second"
                      />
                      <Input
                        value={secondaryButtonLabel}
                        onChange={(e) => setSecondaryButtonLabel(e.target.value)}
                        placeholder="Second button label"
                        maxLength={20}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSecondLinkOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2 text-sm text-muted hover:border-border-hover hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add a second link
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLinkOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2 text-sm text-muted hover:border-border-hover hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a link
                </button>
              )}
              <p className="text-xs text-muted">
                {"{link}"} inserts the tracked link; {"{username}"} personalizes.
              </p>
            </FlowStep>

            <FlowStep
              number={6}
              icon={Clock}
              title="Follow-up"
              helper="A thank-you message sent after they tap the link."
              active={followUpEnabled}
              toggle={
                <Toggle
                  checked={followUpEnabled}
                  onChange={setFollowUpEnabled}
                  aria-label="Enable follow-up message"
                />
              }
            >
              {followUpEnabled && (
                <div className="space-y-2">
                  <Textarea
                    value={followUpMessage}
                    onChange={(e) => setFollowUpMessage(e.target.value)}
                    placeholder={CAMPAIGN_DEFAULTS.followUpMessage}
                    rows={3}
                    className="resize-none"
                    maxLength={1000}
                  />
                  <ResetToDefault
                    value={followUpMessage}
                    defaultValue={CAMPAIGN_DEFAULTS.followUpMessage}
                    onReset={() => setFollowUpMessage(CAMPAIGN_DEFAULTS.followUpMessage)}
                  />
                  <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    <span className="text-xs text-muted">Send it</span>
                    <Input
                      type="number"
                      min={0}
                      max={1440}
                      value={followUpDelayMinutes}
                      onChange={(e) =>
                        setFollowUpDelayMinutes(
                          Math.max(0, Math.min(1440, Math.floor(Number(e.target.value) || 0)))
                        )
                      }
                      className="w-20"
                    />
                    <span className="text-xs text-muted">
                      minutes after the link
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {followUpDelayMinutes > 0
                      ? `Sent ${followUpDelayMinutes} min after they tap through.`
                      : "Sent right after they tap through."}
                    {" {username}"} personalizes it. Max 24 hours, to stay inside
                    Instagram&apos;s messaging window.
                  </p>
                </div>
              )}
            </FlowStep>
          </div>
        </div>
      </div>

      {/* Right: preview */}
      <div>
        <p className="mb-4 text-sm text-muted">Preview</p>
        <div className="flex min-w-0 justify-center lg:sticky lg:top-6 lg:block">
          <CampaignPreview
            tab={previewTab}
            onTabChange={setPreviewTab}
            username={username}
            avatarUrl={avatarUrl}
            postThumb={postThumb}
            caption={postCaption}
            sampleComment={keywords[0] ?? ""}
            dmTriggerEnabled={dmTriggerEnabled}
            publicReplyEnabled={publicReplyEnabled}
            publicReplyMessage={publicReplyMessages.find((m) => m.trim()) ?? ""}
            openingDmEnabled={openingDmEnabled}
            openingDmMessage={openingDmMessage}
            openingDmButtonLabel={openingDmButtonLabel}
            revealMessage={dmMessage}
            hasLink={Boolean(trackedDestinationUrl.trim())}
            linkButtonLabel={linkButtonLabel || CAMPAIGN_DEFAULTS.linkButtonLabel}
            linkUrl={trackedDestinationUrl.trim() || undefined}
            hasSecondLink={
              secondLinkOpen && Boolean(secondaryDestinationUrl.trim())
            }
            secondLinkButtonLabel={secondaryButtonLabel || CAMPAIGN_DEFAULTS.secondaryButtonLabel}
            requireFollow={requireFollow}
            followPromptMessage={followPromptMessage}
            followPromptButtonLabel={followPromptButtonLabel || CAMPAIGN_DEFAULTS.followPromptButtonLabel}
            followUpEnabled={followUpEnabled}
            followUpMessage={followUpMessage}
            followUpDelayMinutes={followUpDelayMinutes}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
