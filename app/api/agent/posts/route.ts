import { NextRequest, NextResponse } from "next/server";
import { getAgentContext } from "@/lib/agent-auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { getUserMedia } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

export const runtime = "nodejs";

/**
 * Recent posts and reels, newest first, so the agent can choose the `postId`
 * a campaign listens on. `?limit=` is 1-50 (default 10).
 */
export async function GET(request: NextRequest) {
  const agent = await getAgentContext(request);
  if (!agent) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    agent.workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected" },
      { status: 400 }
    );
  }

  const parsedLimit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "10",
    10
  );
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : 10;

  try {
    const posts = await getUserMedia(decryptToken(account.accessToken), limit);
    return NextResponse.json({
      success: true,
      data: posts.map((post) => ({
        id: post.id,
        caption: post.caption ?? null,
        mediaType: post.media_type,
        productType: post.media_product_type ?? null,
        permalink: post.permalink ?? null,
        timestamp: post.timestamp,
        likes: post.like_count ?? null,
        comments: post.comments_count ?? null,
      })),
    });
  } catch (err) {
    console.error("[Agent Posts] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch Instagram posts" },
      { status: 500 }
    );
  }
}
