/**
 * Password hashing — Unit Tests
 *
 * Round-trips through the real scrypt implementation (no mocking needed;
 * it's pure Node crypto), plus malformed/tampered-hash and length-bound
 * checks.
 */

import { describe, it, expect } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  validateNewPassword,
  verifyPassword,
} from "../lib/password";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a different hash (different salt) for the same password each time", async () => {
    const first = await hashPassword("same-password");
    const second = await hashPassword("same-password");
    expect(first).not.toBe(second);
    expect(await verifyPassword("same-password", first)).toBe(true);
    expect(await verifyPassword("same-password", second)).toBe(true);
  });

  it("stores in the documented scrypt$N$r$p$salt$hash format", async () => {
    const hash = await hashPassword("format-check");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number.parseInt(parts[1], 10)).toBeGreaterThan(0);
  });

  it("fails safe on a malformed stored hash", async () => {
    await expect(verifyPassword("anything", "not-a-real-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "")).resolves.toBe(false);
    await expect(verifyPassword("anything", "scrypt$only$three$parts")).resolves.toBe(
      false
    );
  });

  it("fails safe on a tampered hash (bad base64 / wrong cost params)", async () => {
    const hash = await hashPassword("tamper-me");
    const [prefix, n, r, p, salt] = hash.split("$");
    const tamperedBase64 = `${prefix}$${n}$${r}$${p}$${salt}$not-valid-base64!!!`;
    await expect(verifyPassword("tamper-me", tamperedBase64)).resolves.toBe(false);

    const absurdCost = `${prefix}$999999999$${r}$${p}$${salt}$AAAA`;
    await expect(verifyPassword("tamper-me", absurdCost)).resolves.toBe(false);

    const negativeCost = `${prefix}$-1$${r}$${p}$${salt}$AAAA`;
    await expect(verifyPassword("tamper-me", negativeCost)).resolves.toBe(false);
  });

  it("never verifies true against the dummy hash used for timing safety", async () => {
    expect(await verifyPassword("anything at all", DUMMY_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword("openreply-dummy-verify", DUMMY_PASSWORD_HASH)).toBe(
      false
    );
  });
});

describe("validateNewPassword", () => {
  it("accepts a password within bounds", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(validateNewPassword("a".repeat(MAX_PASSWORD_LENGTH))).toBeNull();
    expect(validateNewPassword("a reasonable password")).toBeNull();
  });

  it("rejects a password shorter than the minimum", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
  });

  it("rejects a password longer than the maximum", () => {
    expect(validateNewPassword("a".repeat(MAX_PASSWORD_LENGTH + 1))).not.toBeNull();
  });

  it("rejects a missing/empty password", () => {
    expect(validateNewPassword("")).not.toBeNull();
    expect(validateNewPassword(undefined)).not.toBeNull();
    expect(validateNewPassword(null)).not.toBeNull();
  });
});
