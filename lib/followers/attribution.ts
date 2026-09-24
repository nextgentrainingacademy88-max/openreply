import { prisma } from "@/lib/db/client";

/**
 * Record the outcome of a campaign's follow-gate check, so the campaign can be
 * credited with the followers it gained.
 *
 * - `false`: the person does not follow yet. Opens an attribution row (once).
 * - `true`: they follow. Closes the row if one is open; someone who already
 *   followed at their first check has no row and is not counted.
 * - `null`: unverifiable, nothing to record.
 *
 * Attribution is bookkeeping only: it never throws, so a database hiccup here
 * can't block or fail a DM.
 */
export async function recordFollowCheck(params: {
  workspaceId: string;
  automationId: string;
  instagramUserId: string;
  follows: boolean | null;
}): Promise<void> {
  const { workspaceId, automationId, instagramUserId, follows } = params;
  if (follows === null) return;

  try {
    if (follows === false) {
      await prisma.campaignFollow.upsert({
        where: { automationId_instagramUserId: { automationId, instagramUserId } },
        create: { workspaceId, automationId, instagramUserId },
        update: {},
      });
      return;
    }

    await prisma.campaignFollow.updateMany({
      where: { automationId, instagramUserId, followedAt: null },
      data: { followedAt: new Date() },
    });
  } catch (error) {
    console.log(
      "[Follow attribution] Failed to record follow check:",
      error instanceof Error ? error.message : error
    );
  }
}
