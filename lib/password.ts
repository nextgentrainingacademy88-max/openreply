/**
 * Password hashing
 *
 * Node's built-in `crypto.scrypt`, so email + password sign-in needs no new
 * dependency. Stored format is self-describing so the cost parameters can
 * change later without invalidating existing hashes:
 *
 *   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 *
 * N/r/p are Node's own scrypt defaults (16384/8/1), which comfortably fit
 * scrypt's default 32MB `maxmem` ceiling (128 * N * r bytes ≈ 16MB here).
 */

import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_PREFIX = "scrypt";

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/** Hash a plaintext password for storage in `User.passwordHash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return formatHash(SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derivedKey);
}

function formatHash(N: number, r: number, p: number, salt: Buffer, hash: Buffer): string {
  return [SCRYPT_PREFIX, N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

/**
 * Verify a plaintext password against a stored hash. Never throws: a
 * missing, malformed, or tampered `stored` value fails closed (returns
 * false) rather than crashing, and still spends roughly the same time as a
 * real check so it doesn't reveal which case it hit.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) {
    // Spend comparable time to a real verify so failure timing doesn't
    // distinguish "malformed hash" from "wrong password".
    await hashPassword(password).catch(() => undefined);
    return false;
  }

  const { N, r, p, salt, hash } = parsed;
  try {
    const derived = await scryptAsync(password, salt, hash.length, { N, r, p });
    if (derived.length !== hash.length) return false;
    return timingSafeEqual(derived, hash);
  } catch {
    // Corrupt/out-of-range cost parameters (e.g. from a tampered row) can
    // make scrypt throw (it enforces a maxmem ceiling). Fail closed.
    return false;
  }
}

function parseStoredHash(
  stored: string
): { N: number; r: number; p: number; salt: Buffer; hash: Buffer } | null {
  if (typeof stored !== "string") return null;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== SCRYPT_PREFIX) return null;

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts;
  const N = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return null;
  // Guard against a tampered row asking for an absurd cost that would hang
  // or blow scrypt's memory ceiling.
  if (N > 1 << 20 || r > 1024 || p > 1024) return null;

  let salt: Buffer;
  let hash: Buffer;
  try {
    salt = Buffer.from(saltB64, "base64");
    hash = Buffer.from(hashB64, "base64");
  } catch {
    return null;
  }
  if (salt.length === 0 || hash.length === 0) return null;

  return { N, r, p, salt, hash };
}

/**
 * A precomputed, valid-format hash that verifies against no real password.
 * `authorizeCredentials` checks against this when the account doesn't exist
 * or has no password set, so scrypt still runs and login timing doesn't
 * leak which emails are registered.
 */
export const DUMMY_PASSWORD_HASH = formatHash(
  SCRYPT_N,
  SCRYPT_R,
  SCRYPT_P,
  randomBytes(SALT_LENGTH),
  scryptSync("openreply-dummy-verify", randomBytes(SALT_LENGTH), KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
);

/**
 * Validate a new/changed password before hashing it.
 * Returns an error message, or null when the password is acceptable.
 */
export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
