/**
 * Shared HTTP utilities used across all route handlers.
 *
 * Centralised here to avoid duplicating headers and response helpers
 * in every route file.
 */
import type { IncomingMessage, ServerResponse } from "node:http";


const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

/**
 * Resolves the correct `Access-Control-Allow-Origin` value for a given
 * request origin. Supports:
 *   - "*"                    → allow all (default)
 *   - "https://yourdomain.com" → exact match
 *   - "*.yourdomain.com"     → any subdomain (+ apex) of yourdomain.com
 *   - comma-separated list of the above
 */
export const getAllowedOrigin = (requestOrigin?: string): string => {
  if (CORS_ORIGIN === "*") return "*";
  if (!requestOrigin) return CORS_ORIGIN.split(",")[0].trim(); // non-browser / same-origin

  const patterns = CORS_ORIGIN.split(",").map(p => p.trim());
  for (const pattern of patterns) {
    if (pattern === requestOrigin) return requestOrigin;           // exact match
    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);                              // "yourdomain.com"
      if (requestOrigin.endsWith("." + base))  return requestOrigin; // app.yourdomain.com
      if (requestOrigin === "https://" + base) return requestOrigin; // apex https
      if (requestOrigin === "http://"  + base) return requestOrigin; // apex http (dev)
    }
  }
  // No match — return first pattern; browser will block the request
  return patterns[0];
};

export const getCorsHeaders = (requestOrigin?: string): Record<string, string> => ({
  "Access-Control-Allow-Origin":  getAllowedOrigin(requestOrigin),
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age":       "86400",
  // Vary: Origin tells caches that the response differs per origin
  ...(CORS_ORIGIN !== "*" ? { "Vary": "Origin" } : {})
});

// Convenience export for places that don’t have access to the request
export const corsHeaders = getCorsHeaders();

export const sendJson = (
  res:          ServerResponse,
  status:       number,
  body:         unknown,
  extraHeaders?: Record<string, string>,
  req?:         IncomingMessage          // optional — used for dynamic CORS origin
): void => {
  const origin = req?.headers.origin as string | undefined;
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...getCorsHeaders(origin),
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
};

export const parseBody = (req: IncomingMessage, maxSize = 2 * 1024 * 1024): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error("Payload too large (max 2MB)"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end",   () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
