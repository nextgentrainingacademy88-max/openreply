"use client";

/**
 * Dashboard Home Page
 *
 * Overview cards, 7-day chart, and recent activity feed.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Hash,
  Inbox,
  Megaphone,
  MousePointerClick,
  Percent,
  Send,
  SkipForward,
  Sparkles,
  XCircle,
} from "lucide-react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import StatusBadge from "@/components/status-badge";
import { Card, CardHeader, CardTitle, EmptyState, PageHeader, StatCard } from "@/components/ui";

interface DashboardStats {
  userName: string | null;
  contactsCount: number;
  totalAutomations: number;
  activeAutomations: number;
  dmsSentToday: number;
  dmsSentWeek: number;
  dmsSentMonth: number;
  dmsSkippedMonth: number;
  dmsFailedMonth: number;
  totalDMs: number;
  clicksThisMonth: number;
  totalClicks: number;
  ctrThisMonth: number;
  instagramAccounts: AccountOption[];
  selectedInstagramAccountId: string | null;
  topKeywords: { keyword: string; count: number }[];
  dailyDMs: { date: string; count: number }[];
  recentLogs: Array<{
    id: string;
    commenterName: string | null;
    commentText: string;
    status: string;
    createdAt: string;
    automation: { name: string };
    instagramAccount?: { username: string };
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") {
      params.set("instagramAccountId", selectedAccountId);
    }

    fetch(`/api/dashboard/stats${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStats(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  function handleAccountChange(accountId: string) {
    setLoading(true);
    setSelectedAccountId(accountId);
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-16 w-full max-w-md animate-pulse rounded-2xl bg-surface-hover" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="panel p-5 h-32 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-surface-hover" />
              <div className="mt-4 h-6 w-16 bg-surface-hover rounded" />
              <div className="mt-2 h-4 w-24 bg-surface-hover/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxDM = Math.max(...(stats?.dailyDMs.map((d) => d.count) ?? [1]), 1);

  const connectedCount = stats?.instagramAccounts.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello, ${stats?.userName ?? "there"}!`}
        description={
          <>
            {connectedCount} connected{" "}
            {connectedCount === 1 ? "account" : "accounts"}
            {" · "}
            {stats?.contactsCount ?? 0}{" "}
            {stats?.contactsCount === 1 ? "contact" : "contacts"}
            {" · "}
            <Link href="/logs" className="text-accent hover:underline">
              See activity
            </Link>
          </>
        }
        actions={
          stats && stats.instagramAccounts.length > 1 ? (
            <AccountSelect
              accounts={stats.instagramAccounts}
              value={selectedAccountId}
              onChange={handleAccountChange}
            />
          ) : undefined
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard
          label="Active Campaigns"
          value={stats?.activeAutomations ?? 0}
          icon={Megaphone}
        />
        <StatCard label="DMs Sent" value={stats?.dmsSentMonth ?? 0} icon={Send} />
        <StatCard label="Skipped" value={stats?.dmsSkippedMonth ?? 0} icon={SkipForward} />
        <StatCard label="Failed" value={stats?.dmsFailedMonth ?? 0} icon={XCircle} />
        <StatCard label="Clicks" value={stats?.clicksThisMonth ?? 0} icon={MousePointerClick} />
        <StatCard label="CTR" value={`${stats?.ctrThisMonth ?? 0}%`} icon={Percent} />
      </div>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 sm:gap-6">
        {/* 7-Day Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />
              DMs — Last 7 Days
            </CardTitle>
          </CardHeader>
          <div className="flex items-end gap-1.5 h-40 sm:gap-2">
            {stats?.dailyDMs.map((day) => (
              <div key={day.date} className="min-w-0 flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-muted font-medium">{day.count}</span>
                <div
                  className="w-full rounded-t-lg bg-accent min-h-[4px]"
                  style={{ height: `${Math.max((day.count / maxDM) * 100, 4)}%` }}
                />
                {/* Seven labels share a phone's width, so they must not wrap. */}
                <span className="w-full truncate text-center text-[10px] text-muted">
                  {day.date}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Keywords */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-accent" aria-hidden="true" />
              Top Keywords
            </CardTitle>
          </CardHeader>
          {stats?.topKeywords.length === 0 ? (
            <EmptyState icon={Hash} title="No keyword matches yet" className="py-8" />
          ) : (
            <div className="space-y-3">
              {stats?.topKeywords.map((keyword, index) => (
                <div key={keyword.keyword} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {keyword.keyword}
                  </span>
                  <span className="text-xs text-muted">{keyword.count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          {stats?.recentLogs.length === 0 ? (
            <EmptyState icon={Inbox} title="No activity yet" className="py-8" />
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {stats?.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border last:border-0"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                    {(log.commenterName ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      @{log.commenterName ?? "unknown"}
                    </p>
                    <p className="text-xs text-muted truncate">
                      {log.instagramAccount
                        ? `@${log.instagramAccount.username} · `
                        : ""}
                      {log.commentText}
                    </p>
                  </div>
                  <StatusBadge status={log.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
