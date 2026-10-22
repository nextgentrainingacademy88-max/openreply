import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  connectFacebookPage,
  FacebookPagesUnavailableError,
  listAvailablePages,
} from "@/lib/facebook/pages";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof FacebookPagesUnavailableError) {
    return NextResponse.json(
      { success: false, error: error.message, code: "token_missing" },
      { status: 400 }
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ success: false, error: message }, { status: 502 });
}

/** Facebook Pages the server's system-user token can connect. */
export async function GET() {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const pages = await listAvailablePages(context.workspaceId);
    return NextResponse.json({ success: true, data: { pages } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Connect one Page (`{ pageId }`) to the current workspace. */
export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can connect accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const pageId = typeof body.pageId === "string" ? body.pageId : null;
  if (!pageId) {
    return NextResponse.json(
      { success: false, error: "pageId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await connectFacebookPage(context.workspaceId, pageId);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    if (result.warnings.length > 0) {
      await prisma.operationalEvent
        .create({
          data: {
            source: "SYSTEM",
            level: "WARNING",
            workspaceId: context.workspaceId,
            message: `Facebook Page connected with warnings: ${result.name}`,
            payload: { warnings: result.warnings },
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
