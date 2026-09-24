import { NextRequest, NextResponse } from "next/server";
import { getAgentContext } from "@/lib/agent-auth";
import {
  createCampaign,
  listCampaigns,
  updateCampaign,
} from "@/lib/automations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

/**
 * Campaigns in a compact shape for the agent. `?id=` returns just that one.
 */
export async function GET(request: NextRequest) {
  const agent = await getAgentContext(request);
  if (!agent) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  const campaigns = (await listCampaigns(agent.workspaceId))
    .filter((campaign) => !id || campaign.id === id)
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      isActive: campaign.isActive,
      account: campaign.instagramAccount?.username ?? null,
      postId: campaign.postId,
      postUrl: campaign.postUrl,
      matchAnyPost: campaign.matchAnyPost,
      pendingNextReel: campaign.pendingNextReel,
      keywords: campaign.keywords,
      matchAnyWord: campaign.matchAnyWord,
      dmMessage: campaign.dmMessage,
      publicReplyMessages: campaign.publicReplyMessages,
      requireFollow: campaign.requireFollow,
      links: campaign.trackedLinks.map((link) => link.destinationUrl),
      reportUrl: campaign.reportUrl,
      analytics: campaign.analytics,
      createdAt: campaign.createdAt,
    }));

  if (id && campaigns.length === 0) {
    return NextResponse.json(
      { success: false, error: "Campaign not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, data: id ? campaigns[0] : campaigns },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Create a campaign. It is ALWAYS stored as a draft (switched off): an agent
 * proposes, the owner approves, and going live is a separate PATCH
 * `{ "isActive": true }`.
 */
export async function POST(request: NextRequest) {
  const agent = await getAgentContext(request);
  if (!agent) return unauthorized();

  const result = await createCampaign(agent.workspaceId, await request.json(), {
    forceDraft: true,
  });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, details: result.details },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { success: true, data: result.data },
    { status: result.status }
  );
}

/** Update a campaign by `?id=`: edit it, go live, or pause it. */
export async function PATCH(request: NextRequest) {
  const agent = await getAgentContext(request);
  if (!agent) return unauthorized();

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Missing campaign ID" },
      { status: 400 }
    );
  }

  const result = await updateCampaign(
    agent.workspaceId,
    id,
    await request.json()
  );
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error, details: result.details },
      { status: result.status }
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
