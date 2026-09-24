/**
 * Credentials provider authorize logic, pulled out of lib/auth.ts so it can
 * be unit tested without booting NextAuth.
 *
 * Rate limiting reuses the ioredis connection from lib/queue/client.ts
 * (already required for BullMQ) rather than standing up a second Redis
 * client. If Redis is unreachable, rate-limit checks fail OPEN (login is
 * allowed to proceed) so a Redis outage never locks the owner out — but the
 * password check itself always runs regardless, so Redis being down never
 * grants access.
 */

import { prisma } from "@/lib/db/client";
import { getRedisConnection } from "@/lib/queue/client";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/password";

const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
// The shared connection uses maxRetriesPerRequest: null (BullMQ needs it), so
// a command queues forever while Redis is down. Bound every limiter call so a
// Redis outage fails open quickly instead of hanging the login form.
const REDIS_TIMEOUT_MS = 1500;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Redis timed out")), REDIS_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export interface CredentialsUser {
  id: string;
  email: string;
  name: string | null;
}

function emailFailureKey(email: string): string {
  return `ratelimit:login:email:${email}`;
}

function ipFailureKey(ip: string): string {
  return `ratelimit:login:ip:${ip}`;
}

const INCR_WITH_TTL_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

/** Returns the current failure count for a key, or null if Redis is unreachable. */
async function getFailureCount(key: string): Promise<number | null> {
  try {
    const client = getRedisConnection();
    const value = await withTimeout(client.get(key));
    return value ? Number.parseInt(value, 10) : 0;
  } catch (error) {
    console.error("[auth] login rate limiter read failed, failing open", error);
    return null;
  }
}

/**
 * Whether email or IP is currently over the failure cap. Fails open (false)
 * when Redis can't be reached.
 */
async function isRateLimited(email: string, ip: string): Promise<boolean> {
  const [emailCount, ipCount] = await Promise.all([
    getFailureCount(emailFailureKey(email)),
    getFailureCount(ipFailureKey(ip)),
  ]);
  if (emailCount === null || ipCount === null) return false;
  return emailCount >= MAX_FAILURES_PER_EMAIL || ipCount >= MAX_FAILURES_PER_IP;
}

/** Records one failed attempt against both the email and IP buckets. Best effort. */
async function recordFailure(email: string, ip: string): Promise<void> {
  try {
    const client = getRedisConnection();
    await withTimeout(Promise.all([
      client.eval(
        INCR_WITH_TTL_SCRIPT,
        1,
        emailFailureKey(email),
        LOGIN_RATE_LIMIT_WINDOW_SECONDS
      ),
      client.eval(INCR_WITH_TTL_SCRIPT, 1, ipFailureKey(ip), LOGIN_RATE_LIMIT_WINDOW_SECONDS),
    ]));
  } catch (error) {
    console.error("[auth] login rate limiter write failed", error);
  }
}

/** Clears the email's failure bucket after a successful sign-in. Best effort. */
async function clearEmailFailures(email: string): Promise<void> {
  try {
    const client = getRedisConnection();
    await withTimeout(client.del(emailFailureKey(email)));
  } catch {
    // Non-fatal: a stale counter just means slightly stricter rate limiting
    // until it expires on its own.
  }
}

/** Extracts a best-effort client IP from the request for rate-limit bucketing. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Credentials provider `authorize`. Looks the user up by lower-cased,
 * trimmed email, requires a passwordHash, and verifies it. Always runs a
 * scrypt verify (real or dummy) so response timing doesn't reveal whether
 * an email is registered or has a password set. Returns null on any
 * failure — never a specific reason, so the login form can only show a
 * generic error.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>>,
  request: Request
): Promise<CredentialsUser | null> {
  const emailInput = typeof credentials?.email === "string" ? credentials.email : "";
  const password = typeof credentials?.password === "string" ? credentials.password : "";
  const email = emailInput.trim().toLowerCase();

  if (!email || !password) {
    return null;
  }

  const ip = getClientIp(request);

  if (await isRateLimited(email, ip)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  // Always verify against *some* hash — the real one, or a fixed dummy hash
  // when the account or its password doesn't exist — so a missing user and
  // a wrong password take the same code path and roughly the same time.
  const passwordIsValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !user.passwordHash || !passwordIsValid) {
    await recordFailure(email, ip);
    return null;
  }

  await clearEmailFailures(email);

  return { id: user.id, email: user.email ?? email, name: user.name };
}
