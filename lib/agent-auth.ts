import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";

/**
 * Machine access for an operator agent (e.g. Hermes) to the /api/agent/*
 * routes. The agent sends `Authorization: Bearer <AGENT_API_KEY>` and acts on
 * one workspace: AGENT_WORKSPACE_ID, or the only workspace when that is unset
 * (the usual self-hosted install).
 *
 * The key is disabled unless it is set and at least 32 characters, so a
 * missing or placeholder value can never open the API.
 */
const MIN_KEY_LENGTH = 32;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isValidAgentKey(authorization: string | null): boolean {
  const key = process.env.AGENT_API_KEY;
  if (!key || key.length < MIN_KEY_LENGTH) return false;
  if (!authorization?.startsWith("Bearer ")) return false;

  // Hash both sides so the comparison is constant-time regardless of length.
  const supplied = authorization.slice("Bearer ".length);
  return timingSafeEqual(digest(supplied), digest(key));
}

async function resolveAgentWorkspaceId(): Promise<string | null> {
  const configured = process.env.AGENT_WORKSPACE_ID;
  if (configured) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: configured },
      select: { id: true },
    });
    return workspace?.id ?? null;
  }

  // Without an explicit workspace, only an install with exactly one is safe.
  const workspaces = await prisma.workspace.findMany({
    select: { id: true },
    take: 2,
  });
  return workspaces.length === 1 ? workspaces[0].id : null;
}

export type AgentContext = { workspaceId: string };

/**
 * The agent's workspace for this request, or null when the key is wrong or
 * the workspace can't be resolved. Callers answer null with a 401.
 */
export async function getAgentContext(
  request: Request
): Promise<AgentContext | null> {
  if (!isValidAgentKey(request.headers.get("authorization"))) return null;

  const workspaceId = await resolveAgentWorkspaceId();
  return workspaceId ? { workspaceId } : null;
}
