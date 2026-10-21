import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockGetUserMedia } = vi.hoisted(() => ({
  mockPrisma: {
    automation: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  mockGetUserMedia: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/meta/client", () => ({ getUserMedia: mockGetUserMedia }));
vi.mock("@/lib/meta/oauth", () => ({ decryptToken: (t: string) => `plain_${t}` }));

import {
  bindPendingNextReelsOnComment,
  findNextReel,
} from "../lib/automations/next-reel";

const createdAt = new Date("2026-10-22T04:00:00Z");
const media = [
  { id: "reel_new_2", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-10-23T11:00:00+0000", permalink: "https://instagram.com/reel/B" },
  { id: "post_after", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-10-22T08:00:00+0000" },
  { id: "reel_new_1", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-10-22T11:00:00+0000", permalink: "https://instagram.com/reel/A" },
  { id: "reel_old", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-10-21T10:00:00+0000" },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.automation.update.mockResolvedValue({});
  mockGetUserMedia.mockResolvedValue(media);
});

describe("findNextReel", () => {
  it("picks the earliest reel posted after the campaign, ignoring feed posts and older reels", () => {
    expect(findNextReel(media, createdAt)?.id).toBe("reel_new_1");
  });

  it("returns undefined while no reel has been posted since", () => {
    expect(findNextReel(media.slice(1, 2), createdAt)).toBeUndefined();
  });
});

describe("bindPendingNextReelsOnComment", () => {
  it("binds a waiting campaign to the account's next reel", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([
      { id: "auto_1", createdAt, instagramAccount: { accessToken: "enc" } },
    ]);

    const bound = await bindPendingNextReelsOnComment("ig_456");

    expect(bound).toBe(1);
    expect(mockGetUserMedia).toHaveBeenCalledWith("plain_enc", 25);
    expect(mockPrisma.automation.update).toHaveBeenCalledWith({
      where: { id: "auto_1" },
      data: {
        postId: "reel_new_1",
        postUrl: "https://instagram.com/reel/A",
        pendingNextReel: false,
      },
    });
  });

  it("does nothing (and calls no API) when no campaign is waiting", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([]);

    expect(await bindPendingNextReelsOnComment("ig_456")).toBe(0);
    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });

  it("never throws when the media fetch fails", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([
      { id: "auto_1", createdAt, instagramAccount: { accessToken: "enc" } },
    ]);
    mockGetUserMedia.mockRejectedValue(new Error("token expired"));

    await expect(bindPendingNextReelsOnComment("ig_456")).resolves.toBe(0);
    expect(mockPrisma.automation.update).not.toHaveBeenCalled();
  });
});
