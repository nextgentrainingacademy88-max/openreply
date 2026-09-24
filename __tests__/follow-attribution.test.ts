import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    campaignFollow: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));

import { recordFollowCheck } from "../lib/followers/attribution";

const base = {
  workspaceId: "ws_1",
  automationId: "auto_1",
  instagramUserId: "igsid_1",
};

describe("recordFollowCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens an attribution row when the person does not follow yet", async () => {
    await recordFollowCheck({ ...base, follows: false });

    expect(mockPrisma.campaignFollow.upsert).toHaveBeenCalledWith({
      where: {
        automationId_instagramUserId: {
          automationId: "auto_1",
          instagramUserId: "igsid_1",
        },
      },
      create: base,
      update: {},
    });
    expect(mockPrisma.campaignFollow.updateMany).not.toHaveBeenCalled();
  });

  it("closes only an open row when the person follows", async () => {
    await recordFollowCheck({ ...base, follows: true });

    expect(mockPrisma.campaignFollow.updateMany).toHaveBeenCalledWith({
      where: {
        automationId: "auto_1",
        instagramUserId: "igsid_1",
        followedAt: null,
      },
      data: { followedAt: expect.any(Date) },
    });
    expect(mockPrisma.campaignFollow.upsert).not.toHaveBeenCalled();
  });

  it("records nothing when follow status is unverifiable", async () => {
    await recordFollowCheck({ ...base, follows: null });

    expect(mockPrisma.campaignFollow.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.campaignFollow.updateMany).not.toHaveBeenCalled();
  });

  it("never throws, so a database error can't block a DM", async () => {
    mockPrisma.campaignFollow.upsert.mockRejectedValue(new Error("db down"));

    await expect(
      recordFollowCheck({ ...base, follows: false })
    ).resolves.toBeUndefined();
  });
});
