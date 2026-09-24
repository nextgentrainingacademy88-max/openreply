import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    workspace: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    instagramAccount: {
      findFirst: vi.fn(),
    },
    automation: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import { getAgentContext, isValidAgentKey } from "../lib/agent-auth";
import { createCampaign } from "../lib/automations/service";

const KEY = "k".repeat(40);

function requestWith(authorization?: string) {
  return new Request("https://openreply.test/api/agent/campaigns", {
    headers: authorization ? { authorization } : {},
  });
}

describe("agent key auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AGENT_API_KEY", KEY);
    vi.stubEnv("AGENT_WORKSPACE_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the configured bearer key", () => {
    expect(isValidAgentKey(`Bearer ${KEY}`)).toBe(true);
  });

  it("rejects a wrong, missing or non-bearer key", () => {
    expect(isValidAgentKey(`Bearer ${"x".repeat(40)}`)).toBe(false);
    expect(isValidAgentKey(null)).toBe(false);
    expect(isValidAgentKey(KEY)).toBe(false);
  });

  it("stays disabled when the key is unset or too short", () => {
    vi.stubEnv("AGENT_API_KEY", "");
    expect(isValidAgentKey("Bearer ")).toBe(false);

    vi.stubEnv("AGENT_API_KEY", "short");
    expect(isValidAgentKey("Bearer short")).toBe(false);
  });

  it("returns null without touching the database on a bad key", async () => {
    await expect(getAgentContext(requestWith("Bearer nope"))).resolves.toBeNull();
    expect(mockPrisma.workspace.findMany).not.toHaveBeenCalled();
  });

  it("uses the only workspace when AGENT_WORKSPACE_ID is unset", async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([{ id: "ws_only" }]);

    await expect(
      getAgentContext(requestWith(`Bearer ${KEY}`))
    ).resolves.toEqual({ workspaceId: "ws_only" });
  });

  it("refuses to guess between several workspaces", async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: "ws_a" },
      { id: "ws_b" },
    ]);

    await expect(
      getAgentContext(requestWith(`Bearer ${KEY}`))
    ).resolves.toBeNull();
  });

  it("uses AGENT_WORKSPACE_ID when it names a real workspace", async () => {
    vi.stubEnv("AGENT_WORKSPACE_ID", "ws_set");
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: "ws_set" });

    await expect(
      getAgentContext(requestWith(`Bearer ${KEY}`))
    ).resolves.toEqual({ workspaceId: "ws_set" });
    expect(mockPrisma.workspace.findMany).not.toHaveBeenCalled();
  });
});

describe("createCampaign forceDraft", () => {
  const input = {
    name: "Workshop guide",
    postId: "media_1",
    keywords: ["WORKSHOP"],
    dmMessage: "Here is the guide {username}",
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: "ws_1" });
    mockPrisma.instagramAccount.findFirst.mockResolvedValue({ id: "ig_row_1" });
    mockPrisma.automation.create.mockImplementation(async ({ data }) => data);
  });

  it("stores an agent-created campaign switched off even if asked to be live", async () => {
    const result = await createCampaign("ws_1", input, { forceDraft: true });

    expect(result.ok).toBe(true);
    expect(mockPrisma.automation.create.mock.calls[0][0].data.isActive).toBe(
      false
    );
  });

  it("keeps the requested state for the dashboard", async () => {
    await createCampaign("ws_1", input);

    expect(mockPrisma.automation.create.mock.calls[0][0].data.isActive).toBe(
      true
    );
  });

  it("rejects input without keywords before touching the database", async () => {
    const result = await createCampaign("ws_1", { ...input, keywords: [] });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockPrisma.automation.create).not.toHaveBeenCalled();
  });
});
