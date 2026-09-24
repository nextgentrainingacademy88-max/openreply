/**
 * Status pill for DM status, built on the shared Badge primitive.
 */

import { Badge, type BadgeTone } from "@/components/ui";

const statusConfig: Record<string, { tone: BadgeTone; label: string }> = {
  SENT: { tone: "success", label: "Sent" },
  FAILED: { tone: "error", label: "Failed" },
  PENDING: { tone: "warning", label: "Pending" },
  SKIPPED_DEDUP: { tone: "neutral", label: "Dedup" },
  SKIPPED_RATE_LIMIT: { tone: "warning", label: "Rate limited" },
  SKIPPED_PLAN_LIMIT: { tone: "warning", label: "Skipped" },
  SKIPPED_NO_MATCH: { tone: "neutral", label: "No match" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.PENDING;

  return <Badge tone={config.tone}>{config.label}</Badge>;
}
