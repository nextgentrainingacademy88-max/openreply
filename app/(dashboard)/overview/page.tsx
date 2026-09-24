"use client";

/**
 * Instagram Overview Page
 *
 * Aggregate reach/engagement across your recent posts, plus a per-post table.
 * Views / reach / saved / shares come from Instagram media insights (requires
 * the insights permission); likes and comments are always available.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Eye,
  Heart,
  ImageOff,
  MessageCircle,
  Radar,
  Share2,
} from "lucide-react";
import AccountSelect from "@/components/account-select";
import FollowerChart from "@/components/follower-chart";
import {
  buttonClasses,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import type { OverviewResponse } from "@/app/api/instagram/overview/route";

function formatNumber(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const COUNT_OPTIONS = [
  { value: "25", label: "Last 25" },
  { value: "50", label: "Last 50" },
  { value: "100", label: "Last 100" },
  { value: "all", label: "All time" },
];

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [count, setCount] = useState("50");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") {
      params.set("instagramAccountId", selectedAccountId);
    }
    params.set("count", count);

    fetch(`/api/instagram/overview?${params}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.error ?? "Failed to load overview");
        }
      })
      .catch(() => setError("Failed to load overview"))
      .finally(() => setLoading(false));
  }, [selectedAccountId, count]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  function handleCountChange(next: string) {
    setLoading(true);
    setCount(next);
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="panel p-4 h-24 sm:p-5 animate-pulse">
            <div className="h-4 w-16 bg-surface-hover rounded" />
            <div className="mt-3 h-6 w-20 bg-surface-hover/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your overview"
          description={error}
          action={
            error.includes("connect") ? (
              // A real <a>, not next/link: this has to force a full browser
              // navigation into the Meta OAuth handshake (see top-bar.tsx).
              <a href="/api/instagram/connect" className={buttonClasses("primary", "md")}>
                Connect Instagram
              </a>
            ) : undefined
          }
        />
      </Card>
    );
  }

  if (!data) return null;

  const { totals, posts, accounts, insightsAvailable, followers, followerHistory } =
    data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={
          <>
            {data.requestedCount === "all" ? "All-time" : "Recent"} —{" "}
            {totals.posts} post{totals.posts === 1 ? "" : "s"} from @
            {data.account.username}
            {data.truncated ? ` (capped at ${totals.posts})` : ""}
            {followers !== null && (
              // Kept alongside the post-range summary: that summary describes
              // the selected posts, whereas this is a current account-level total.
              <>
                {" · "}
                {followers.toLocaleString()} followers
              </>
            )}
          </>
        }
        actions={
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Range
              </span>
              <Select
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                className="min-w-32"
              >
                {COUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            {accounts.length > 1 && (
              <AccountSelect
                accounts={accounts.map((a) => ({
                  id: a.id,
                  username: a.username,
                  instagramId: a.id,
                }))}
                value={selectedAccountId}
                onChange={handleAccountChange}
              />
            )}
          </div>
        }
      />

      {!insightsAvailable && (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <AlertTriangle className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Views, reach, saved and shares need the insights permission.
              </p>
              <p className="text-sm text-muted mt-1">
                Reconnect your account to grant it — likes and comments are shown in
                the meantime.
              </p>
              {/* A real <a>, not next/link: see top-bar.tsx — this must force a
                  full browser navigation into the Meta OAuth handshake. */}
              <a
                href="/api/instagram/connect"
                className={buttonClasses("secondary", "sm", "mt-3")}
              >
                Reconnect Instagram
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* Aggregate totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard label="Views" value={formatNumber(totals.views)} icon={Eye} />
        <StatCard label="Reach" value={formatNumber(totals.reach)} icon={Radar} />
        <StatCard label="Likes" value={formatNumber(totals.likes)} icon={Heart} />
        <StatCard
          label="Comments"
          value={formatNumber(totals.comments)}
          icon={MessageCircle}
        />
        <StatCard label="Saved" value={formatNumber(totals.saved)} icon={Bookmark} />
        <StatCard label="Shares" value={formatNumber(totals.shares)} icon={Share2} />
      </div>

      {/* Follower trend — account-level, independent of the post range */}
      <FollowerChart data={followerHistory} followers={followers} />

      {/* Per-post table */}
      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
        </CardHeader>
        {posts.length === 0 ? (
          <EmptyState icon={ImageOff} title="No posts found" />
        ) : (
          // Eight metric columns can't compress into a phone; let the table keep
          // its natural width and scroll inside the card instead.
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
                  <th className="py-2 pr-4 font-medium">Post</th>
                  <th className="py-2 px-3 font-medium text-right">Views</th>
                  <th className="py-2 px-3 font-medium text-right">Reach</th>
                  <th className="py-2 px-3 font-medium text-right">Likes</th>
                  <th className="py-2 px-3 font-medium text-right">Comments</th>
                  <th className="py-2 px-3 font-medium text-right">Saved</th>
                  <th className="py-2 px-3 font-medium text-right">Shares</th>
                  <th className="py-2 pl-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 pr-4 max-w-xs">
                      {p.permalink ? (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:text-accent truncate block"
                        >
                          {p.caption || `${p.mediaType} post`}
                        </a>
                      ) : (
                        <span className="text-foreground truncate block">
                          {p.caption || `${p.mediaType} post`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.views)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.reach)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.likes)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.comments)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.saved)}
                    </td>
                    <td className="py-3 px-3 text-right text-muted">
                      {formatNumber(p.shares)}
                    </td>
                    <td className="py-3 pl-3 text-right text-muted">
                      {formatDate(p.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
