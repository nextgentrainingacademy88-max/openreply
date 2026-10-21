import { prisma } from "@/lib/db/client";
import { getUserMedia, type InstagramMedia } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";

/**
 * Binding "next reel" campaigns to a real post.
 *
 * Instagram sends no webhook when a new media is published, so a next-reel
 * campaign is bound either by the daily cron or, much sooner, by the worker
 * when the first comment arrives on the account (see bindPendingNextReelsOnComment).
 */

function isReel(media: InstagramMedia): boolean {
  return media.media_product_type === "REELS";
}

/** The "next" reel = the earliest reel posted after the campaign was created. */
export function findNextReel(
  media: InstagramMedia[],
  campaignCreatedAt: Date
): InstagramMedia | undefined {
  return media
    .filter(isReel)
    .sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .find((reel) => new Date(reel.timestamp) > campaignCreatedAt);
}

/**
 * Bind one account's pending next-reel campaigns. Fetches the account's media
 * once; campaigns whose reel is not posted yet stay pending. Throws if the
 * media fetch fails so callers can count or log the failure.
 */
export async function bindNextReelsForAccount(
  encryptedAccessToken: string,
  automations: { id: string; createdAt: Date }[]
): Promise<number> {
  const media = await getUserMedia(decryptToken(encryptedAccessToken), 25);

  let bound = 0;
  for (const automation of automations) {
    const nextReel = findNextReel(media, automation.createdAt);
    if (!nextReel) continue;

    await prisma.automation.update({
      where: { id: automation.id },
      data: {
        postId: nextReel.id,
        postUrl: nextReel.permalink ?? null,
        pendingNextReel: false,
      },
    });
    bound += 1;
  }
  return bound;
}

/**
 * Called by the worker before it matches a comment. If the account has
 * campaigns waiting for its next reel, try to bind them now, so the first
 * comments on a fresh reel get their DM instead of waiting for the daily cron.
 * Never throws: a failure here must not stop the comment from being processed.
 */
export async function bindPendingNextReelsOnComment(
  instagramAccountId: string
): Promise<number> {
  try {
    const pending = await prisma.automation.findMany({
      where: {
        pendingNextReel: true,
        instagramAccount: { instagramId: instagramAccountId },
      },
      select: {
        id: true,
        createdAt: true,
        instagramAccount: { select: { accessToken: true } },
      },
    });
    const accessToken = pending[0]?.instagramAccount.accessToken;
    if (!accessToken) return 0;

    return await bindNextReelsForAccount(accessToken, pending);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[next-reel] bind on comment failed:", message);
    return 0;
  }
}
