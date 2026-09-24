"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  KeyRound,
  RefreshCw,
  Send,
  Timer,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react";
import StatusBadge from "@/components/status-badge";
import { Badge, Button, Card, CardHeader, CardTitle, EmptyState, PageHeader, StatCard } from "@/components/ui";

interface DiagnosticsData {
  queueCounts: Record<string, number>;
  workerHealth: {
    healthy: boolean;
    ageMs: number | null;
    heartbeat: {
      checkedAt: string;
      hostname?: string;
      pid: number;
      startedAt?: string;
    } | null;
  };
  workerAlerts: Array<{
    level: string;
    message: string;
    jobId?: string;
    commentId?: string;
    createdAt: string;
  }>;
  webhookFailures: Array<{
    id: string;
    object: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
  dmFailures: Array<{
    id: string;
    status: string;
    commentId: string;
    commentText: string;
    errorMessage: string | null;
    updatedAt: string;
    automation: { name: string };
  }>;
  tokenRefreshFailures: Array<{
    id: string;
    message: string;
    createdAt: string;
  }>;
  operationalEvents: Array<{
    id: string;
    source: string;
    level: string;
    message: string;
    createdAt: string;
    resolvedAt: string | null;
  }>;
}

const QUEUE_ICONS: Record<string, typeof Clock> = {
  waiting: Clock,
  active: Zap,
  delayed: Timer,
  failed: XCircle,
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {children}
    </Card>
  );
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshDiagnostics() {
    setLoading(true);
    const response = await fetch("/api/admin/diagnostics");
    const payload = await response.json();
    if (payload.success) {
      setData(payload.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialDiagnostics() {
      const response = await fetch("/api/admin/diagnostics");
      const payload = await response.json();
      if (active && payload.success) {
        setData(payload.data);
      }
      if (active) {
        setLoading(false);
      }
    }

    void loadInitialDiagnostics();

    return () => {
      active = false;
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  const workerAgeSeconds =
    data?.workerHealth.ageMs == null
      ? null
      : Math.round(data.workerHealth.ageMs / 1000);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Diagnostics"
        description="Health, queues, webhook failures, billing events, and worker alerts."
        actions={
          <Button variant="secondary" onClick={() => void refreshDiagnostics()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-muted">Worker health</p>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Activity className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-2">
              <Badge tone={data?.workerHealth.healthy ? "success" : "warning"}>
                {data?.workerHealth.healthy ? "Healthy" : "Needs attention"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted">
              {workerAgeSeconds == null
                ? "No heartbeat found"
                : `Last heartbeat ${workerAgeSeconds}s ago`}
            </p>
          </Card>
          {["waiting", "active", "delayed", "failed"].map((key) => (
            <StatCard
              key={key}
              label={`Queue ${key}`}
              value={data?.queueCounts[key] ?? 0}
              icon={QUEUE_ICONS[key]}
            />
          ))}
        </div>

        <Section title="Recent Worker Alerts">
          {data?.workerAlerts.length ? (
            <div className="space-y-3">
              {data.workerAlerts.map((alert) => (
                <div
                  key={`${alert.createdAt}-${alert.jobId ?? alert.message}`}
                  className="rounded-xl border border-border bg-surface-2 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">
                      {alert.message}
                    </p>
                    <Badge tone="error" className="shrink-0">
                      {alert.level}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {formatDate(alert.createdAt)}
                    {alert.commentId ? ` · ${alert.commentId}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={AlertTriangle} title="No worker alerts recorded" />
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Campaign DM Failures And Skips">
            {data?.dmFailures.length ? (
              <div className="space-y-3">
                {data.dmFailures.map((item) => (
                  <div key={item.id} className="border-b border-border pb-3 last:border-0">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {item.automation.name}
                      </p>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {item.commentText}
                    </p>
                    {item.errorMessage && (
                      <p className="mt-1 text-xs text-error">{item.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Send} title="No DM failures or skips" />
            )}
          </Section>

          <Section title="Webhook Failures">
            {data?.webhookFailures.length ? (
              <div className="space-y-3">
                {data.webhookFailures.map((event) => (
                  <div key={event.id} className="border-b border-border pb-3 last:border-0">
                    <p className="text-sm font-semibold text-foreground">
                      {event.object ?? "Instagram webhook"}
                    </p>
                    <p className="mt-1 text-xs text-error">
                      {event.errorMessage ?? "Unknown error"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(event.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Webhook} title="No failed webhook events" />
            )}
          </Section>
        </div>

        <Section title="Token Refresh Failures">
          {data?.tokenRefreshFailures.length ? (
            <div className="space-y-3">
              {data.tokenRefreshFailures.map((event) => (
                <div key={event.id} className="border-b border-border pb-3 last:border-0">
                  <p className="text-sm font-semibold text-foreground">
                    {event.message}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={KeyRound} title="No token refresh failures" />
          )}
        </Section>

        <Section title="Operational Event Timeline">
          {data?.operationalEvents.length ? (
            <div className="space-y-3">
              {data.operationalEvents.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-1 border-b border-border pb-3 last:border-0 sm:grid-cols-[140px_1fr_auto] sm:items-baseline sm:gap-2"
                >
                  <p className="text-xs font-semibold text-muted">{event.source}</p>
                  <p className="text-sm text-foreground">{event.message}</p>
                  <p className="text-xs text-muted">{formatDate(event.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="No operational events recorded" />
          )}
        </Section>
      </div>
    </div>
  );
}
