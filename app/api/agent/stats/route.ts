import { NextResponse } from "next/server";
import { getAgentContext } from "@/lib/agent-auth";
import { listCampaigns } from "@/lib/automations/service";
import { prisma } from "@/lib/db/client";
import { calculateCtr } from "@/lib/tracking/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-call summary for an agent report: all-time totals, per-campaign numbers
 * and the latest follower count per connected account.
 */
export async function GET(request: Request) {
  const agent = await getAgentContext(request);
  if (!agent) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const [campaigns, accounts] = await Promise.all([
    listCampaigns(agent.workspaceId),
    prisma.instagramAccount.findMany({
      where: { workspaceId: agent.workspaceId },
      select: {
        username: true,
        followerSnapshots: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true, followersCount: true },
        },
      },
    }),
  ]);

  const totals = campaigns.reduce(
    (sum, campaign) => ({
      sent: sum.sent + campaign.analytics.sent,
      failed: sum.failed + campaign.analytics.failed,
      skipped: sum.skipped + campaign.analytics.skipped,
      clicks: sum.clicks + campaign.analytics.clicks,
      newFollowers: sum.newFollowers + campaign.analytics.newFollowers,
    }),
    { sent: 0, failed: 0, skipped: 0, clicks: 0, newFollowers: 0 }
  );

  return NextResponse.json({
    success: true,
    data: {
      totals: { ...totals, ctr: calculateCtr(totals.clicks, totals.sent) },
      activeCampaigns: campaigns.filter((campaign) => campaign.isActive).length,
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        isActive: campaign.isActive,
        keywords: campaign.keywords,
        ...campaign.analytics,
      })),
      followers: accounts.map((account) => ({
        username: account.username,
        count: account.followerSnapshots[0]?.followersCount ?? null,
        asOf: account.followerSnapshots[0]?.date ?? null,
      })),
    },
  });
}
