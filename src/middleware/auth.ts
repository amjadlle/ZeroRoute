/**
 * Auth & rate-limiting middleware.
 *
 * Kept separate from route logic so the rules are easy to audit and test
 * without spinning up the full server.
 */
import type { IncomingMessage } from "node:http";

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Returns true if the request carries a valid bearer token for `secretKey`.
 * When no key is configured the gateway runs in open/public mode (returns true).
 * Set ROUTER_API_KEY or ADMIN_KEY to require authentication.
 */
export const isAuthorized = (
  req: IncomingMessage,
  secretKey?: string,
  allowSameOrigin = false
): boolean => {
  if (!secretKey) return true; // no key configured → public mode

  // If same-origin is explicitly allowed (e.g. for the landing page's embedded live demo widget)
  if (allowSameOrigin) {
    const host = req.headers.host;
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const secFetchSite = req.headers["sec-fetch-site"];

    if (secFetchSite === "same-origin") return true;
    if (origin && host && (origin === `http://${host}` || origin === `https://${host}`)) return true;
    if (referer && host) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.host === host) return true;
      } catch {}
    }
  }

  const auth = req.headers.authorization;
  if (!auth) return false;
  return auth === `Bearer ${secretKey}` || auth === secretKey;
};

// ─── Rate limiter ─────────────────────────────────────────────────────────────

type RateLimitEntry = { count: number; windowStart: number };
const store = new Map<string, RateLimitEntry>();

/**
 * Sliding-window rate limiter (no external dependencies).
 * Returns true when the caller should be blocked.
 * @param key      Unique identifier (e.g. client IP)
 * @param limit    Max requests allowed per window
 * @param windowMs Window duration in ms (default: 60 s)
 */
export const isRateLimited = (key: string, limit: number, windowMs = 60_000): boolean => {
  const now   = Date.now();
  const entry = store.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > limit;
};

// Prune stale entries every minute to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.windowStart > 120_000) store.delete(key);
  }
}, 60_000).unref();

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getClientIp = (req: IncomingMessage): string =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";
