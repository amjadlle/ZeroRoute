/**
 * Auth & rate-limiting middleware.
 *
 * Kept separate from route logic so the rules are easy to audit and test
 * without spinning up the full server.
 */
import type { IncomingMessage } from "node:http";

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Checks whether an origin matches allowed CORS patterns dynamically.
 */
const isOriginAllowedByPattern = (origin: string, patternString?: string): boolean => {
  if (!patternString || patternString === "*") return true;
  const patterns = patternString.split(",").map(p => p.trim());
  for (const pattern of patterns) {
    if (pattern === origin) return true;
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      if (origin.endsWith("." + base) || origin === "https://" + base || origin === "http://" + base) return true;
    }
  }
  return false;
};

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
  // If secretKey is undefined or empty:
  // - If allowSameOrigin is true (e.g. public chat gateway mode), allow open access
  // - If allowSameOrigin is false (e.g. admin API routes), fail closed (reject)
  if (!secretKey || secretKey.trim() === "") {
    return allowSameOrigin;
  }

  // If same-origin is explicitly allowed (e.g. for the landing page's embedded live demo widget)
  if (allowSameOrigin) {
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const secFetchSite = req.headers["sec-fetch-site"];

    // Browser-verified same-origin request
    if (secFetchSite === "same-origin") return true;
    
    // Strict host matching (never wildcard)
    if (host) {
      const hostOnly = host.split(":")[0].toLowerCase();
      if (origin) {
        try {
          const orgHost = new URL(origin).hostname.toLowerCase();
          if (orgHost === hostOnly || orgHost === "localhost" || orgHost === "127.0.0.1") return true;
        } catch {}
      }
      if (referer) {
        try {
          const refUrl = new URL(referer);
          if (refUrl.hostname.toLowerCase() === hostOnly || refUrl.hostname === "localhost" || refUrl.hostname === "127.0.0.1") return true;
        } catch {}
      }
    }
  }

  const auth = req.headers.authorization;
  if (!auth) return false;
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();

  // 1. Matches master router / admin key
  if (token === secretKey) return true;

  // 2. Demo tokens in same-origin mode
  return Boolean(allowSameOrigin && (token === "free" || token === "public" || token === "zeroroute"));
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
    // Opportunistic pruning of expired entries (Cloudflare Worker safe)
    if (store.size > 200) {
      for (const [k, e] of store) {
        if (now - e.windowStart > 120_000) store.delete(k);
      }
    }
    return false;
  }
  entry.count++;
  return entry.count > limit;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getClientIp = (req: IncomingMessage): string =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";
