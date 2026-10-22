import { NextResponse } from "next/server";
import { getAgentContext } from "@/lib/agent-auth";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";

/**
 * Connected accounts, for the agent to pick `instagramAccountId`. `platform` is
 * INSTAGRAM or FACEBOOK (a Facebook Page: no follow gate, no next-reel).
 */
export async function GET(request: Request) {
  const agent = await getAgentContext(request);
  if (!agent) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const instagramAccounts = await prisma.instagramAccount.findMany({
    where: { workspaceId: agent.workspaceId },
    orderBy: { connectedAt: "desc" },
    select: {
      id: true,
      username: true,
      instagramId: true,
      name: true,
      platform: true,
    },
  });

  return NextResponse.json({ success: true, data: { instagramAccounts } });
}
