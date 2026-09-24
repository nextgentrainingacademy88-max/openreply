/**
 * Credentials provider `authorize` — Unit Tests
 *
 * Prisma and the Redis-backed login rate limiter are mocked; password
 * hashing goes through the real scrypt implementation so "wrong password"
 * and "right password" exercise the actual verify path.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRedis, mockGetRedisConnection } = vi.hoisted(() => {
  const mockRedis = {
    get: vi.fn(),
    eval: vi.fn(),
    del: vi.fn(),
  };
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
      },
    },
    mockRedis,
    mockGetRedisConnection: vi.fn(() => mockRedis),
  };
});

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue/client", () => ({
  getRedisConnection: mockGetRedisConnection,
}));

import { authorizeCredentials } from "../lib/auth-credentials";
import { hashPassword } from "../lib/password";

function request(ip = "203.0.113.1"): Request {
  return new Request("https://example.com/api/auth/callback/credentials", {
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Under the rate-limit cap by default.
  mockRedis.get.mockResolvedValue("0");
  mockRedis.eval.mockResolvedValue(1);
  mockRedis.del.mockResolvedValue(1);
});

describe("authorizeCredentials", () => {
  it("returns null and records a failure for an unknown email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await authorizeCredentials(
      { email: "nobody@example.com", password: "whatever-password" },
      request()
    );

    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "nobody@example.com" },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    // A failure was recorded (rate-limit counters incremented).
    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("returns null when the user has no password set", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      passwordHash: null,
    });

    const result = await authorizeCredentials(
      { email: "owner@example.com", password: "some-password" },
      request()
    );

    expect(result).toBeNull();
    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("returns null for a wrong password", async () => {
    const passwordHash = await hashPassword("the-real-password");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      passwordHash,
    });

    const result = await authorizeCredentials(
      { email: "owner@example.com", password: "not-the-real-password" },
      request()
    );

    expect(result).toBeNull();
    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("returns the user for the right password, and normalizes the email", async () => {
    const passwordHash = await hashPassword("the-real-password");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      passwordHash,
    });

    const result = await authorizeCredentials(
      { email: "  Owner@Example.com  ", password: "the-real-password" },
      request()
    );

    expect(result).toEqual({ id: "user_1", email: "owner@example.com", name: "Owner" });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "owner@example.com" },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    // Success clears the email's failure bucket.
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it("returns null without checking the password when the email is rate limited", async () => {
    mockRedis.get.mockResolvedValue("5"); // at MAX_FAILURES_PER_EMAIL

    const result = await authorizeCredentials(
      { email: "owner@example.com", password: "the-real-password" },
      request()
    );

    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns null without checking the password when the IP is rate limited", async () => {
    mockRedis.get.mockImplementation((key: string) =>
      Promise.resolve(key.includes(":ip:") ? "20" : "0")
    );

    const result = await authorizeCredentials(
      { email: "owner@example.com", password: "the-real-password" },
      request()
    );

    expect(result).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("fails open on the rate limit (but still checks the password) when Redis is unreachable", async () => {
    mockRedis.get.mockRejectedValue(new Error("redis unavailable"));
    const passwordHash = await hashPassword("the-real-password");
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      passwordHash,
    });

    const result = await authorizeCredentials(
      { email: "owner@example.com", password: "the-real-password" },
      request()
    );

    expect(result).toEqual({ id: "user_1", email: "owner@example.com", name: "Owner" });
  });

  it("returns null for a missing email or password without touching prisma", async () => {
    expect(
      await authorizeCredentials({ email: "", password: "x" }, request())
    ).toBeNull();
    expect(
      await authorizeCredentials({ email: "a@b.com", password: "" }, request())
    ).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
