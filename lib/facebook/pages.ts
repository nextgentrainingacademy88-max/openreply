import { prisma } from "@/lib/db/client";
import { getBaseUrl, getMetaEngagementToken } from "@/lib/env";
import { canConnectInstagramAccount } from "@/lib/instagram-accounts";
import {
  debugToken,
  getManagedPages,
  subscribeAppToPageWebhooks,
  subscribePageToWebhooks,
} from "@/lib/meta/client";
import { encryptToken } from "@/lib/meta/oauth";

/**
 * Facebook Pages connect through the same system-user token as comment likes
 * (META_ENGAGEMENT_ACCESS_TOKEN), not an OAuth round trip: the token already
 * lists the Pages it manages, each with a Page token that never expires. A
 * connected Page is stored as an InstagramAccount row with platform FACEBOOK.
 */

export class FacebookPagesUnavailableError extends Error {
  constructor() {
    super(
      "META_ENGAGEMENT_ACCESS_TOKEN is not set. Add a system user token with the Page permissions to connect Facebook Pages."
    );
    this.name = "FacebookPagesUnavailableError";
  }
}

function requirePagesToken(): string {
  const token = getMetaEngagementToken();
  if (!token) throw new FacebookPagesUnavailableError();
  return token;
}

export interface AvailablePage {
  id: string;
  name: string;
  connected: boolean;
}

/** Pages the token manages, flagged with whether this workspace has each. */
export async function listAvailablePages(workspaceId: string): Promise<AvailablePage[]> {
  const pages = await getManagedPages(requirePagesToken());
  const connected = await prisma.instagramAccount.findMany({
    where: {
      workspaceId,
      platform: "FACEBOOK",
      instagramId: { in: pages.map((p) => p.id) },
    },
    select: { instagramId: true },
  });
  const connectedIds = new Set(connected.map((a) => a.instagramId));

  return pages.map((page) => ({
    id: page.id,
    name: page.name,
    connected: connectedIds.has(page.id),
  }));
}

/**
 * Point the app's Page webhooks at this deployment. Best effort: if it fails
 * (for example the app secret belongs to a different app), the Meta dashboard
 * step still works by hand, so report the reason instead of failing the
 * connect.
 */
async function ensureAppPageWebhook(token: string): Promise<string | null> {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!appSecret || !verifyToken) {
    return "FACEBOOK_APP_SECRET or WEBHOOK_VERIFY_TOKEN is not set";
  }

  try {
    const debug = (await debugToken(token, token)) as { data?: { app_id?: string } };
    const appId = debug.data?.app_id;
    if (!appId) return "Could not read the app id from the token";

    await subscribeAppToPageWebhooks(
      appId,
      appSecret,
      `${getBaseUrl()}/api/webhook`,
      verifyToken
    );
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}

export type ConnectPageResult =
  | {
      ok: true;
      accountId: string;
      name: string;
      webhookSubscribed: boolean;
      warnings: string[];
    }
  | { ok: false; status: number; error: string };

export async function connectFacebookPage(
  workspaceId: string,
  pageId: string
): Promise<ConnectPageResult> {
  const token = requirePagesToken();
  const page = (await getManagedPages(token)).find((p) => p.id === pageId);
  if (!page) {
    return {
      ok: false,
      status: 404,
      error: "That Page is not assigned to the system user behind the token",
    };
  }
  if (!page.access_token) {
    return {
      ok: false,
      status: 400,
      error: "Meta returned no Page token. The system user needs full control of the Page.",
    };
  }

  const connection = await canConnectInstagramAccount({
    workspaceId,
    instagramId: page.id,
  });
  if (!connection.allowed) {
    return {
      ok: false,
      status: 409,
      error: "This Page is already connected to another workspace",
    };
  }

  const warnings: string[] = [];
  const appWebhookError = await ensureAppPageWebhook(token);
  if (appWebhookError) warnings.push(`App webhook: ${appWebhookError}`);

  let webhookSubscribed = false;
  try {
    const subscription = await subscribePageToWebhooks(page.id, page.access_token);
    webhookSubscribed = Boolean(subscription.success);
  } catch (error) {
    warnings.push(
      `Page webhook: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  const data = {
    workspaceId,
    platform: "FACEBOOK" as const,
    username: page.username ?? page.name,
    name: page.name,
    accessToken: encryptToken(page.access_token),
    tokenExpiresAt: null,
    webhookSubscribed,
  };
  const account = await prisma.instagramAccount.upsert({
    where: { instagramId: page.id },
    create: { instagramId: page.id, ...data },
    update: data,
  });

  return {
    ok: true,
    accountId: account.id,
    name: page.name,
    webhookSubscribed,
    warnings,
  };
}
