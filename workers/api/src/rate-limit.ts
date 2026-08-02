/**
 * KV sliding-window rate limit: 30 requests / hour per user per route.
 * Key: rl:<userId>:<route>, TTL 3600.
 * Best-effort: on KV failure, allow the request.
 */
import type { Env } from "./env";

const LIMIT = 30;
const WINDOW_SECONDS = 3600;

export async function checkRateLimit(
  env: Env,
  userId: number | string,
  route: string
): Promise<{ ok: true } | { ok: false; error: "rate_limited" }> {
  try {
    const key = `rl:${userId}:${route}`;
    const raw = await env.RATE_LIMIT.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (!Number.isFinite(count) || count < 0) {
      await env.RATE_LIMIT.put(key, "1", { expirationTtl: WINDOW_SECONDS });
      return { ok: true };
    }
    if (count >= LIMIT) {
      return { ok: false, error: "rate_limited" };
    }
    // Reset TTL on each hit to approximate sliding window of last write.
    // Spec: sliding-window 30/hour; simple counter + TTL is acceptable.
    await env.RATE_LIMIT.put(key, String(count + 1), {
      expirationTtl: WINDOW_SECONDS,
    });
    return { ok: true };
  } catch (err) {
    console.error("rate limit KV failure — allowing", err);
    return { ok: true };
  }
}

export function rateLimitedJson() {
  return { error: "rate_limited" as const };
}
