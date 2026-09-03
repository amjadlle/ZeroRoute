/**
 * Metrics, logs & cache routes.
 *
 * GET    /api/metrics       Return request stats, recent logs, cache size
 * DELETE /api/metrics/logs  Clear the in-memory request log
 * POST   /api/cache/clear   Flush the response cache
 *
 * All routes require ADMIN_KEY authentication.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { metricsLogger }       from "../services/metrics.js";
import { responseCache }       from "../services/cache.js";
import { isAuthorized }        from "../middleware/auth.js";
import { sendJson }            from "../utils/http.js";

const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ROUTER_API_KEY;

export const handleMetricsRoutes = (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): boolean => {

  // GET /api/metrics
  if (req.method === "GET" && url === "/api/metrics") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }

    const allLogs = metricsLogger.getLogs();
    const allStats = metricsLogger.getStats();

    return sendJson(res, 200, {
      stats:     allStats,
      logs:      allLogs,
      cacheSize: responseCache.size()
    }), true;
  }

  // DELETE /api/metrics/logs
  if (req.method === "DELETE" && url === "/api/metrics/logs") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    metricsLogger.clear();
    return sendJson(res, 200, { ok: true, message: "Logs cleared" }), true;
  }

  // POST /api/cache/clear
  if (req.method === "POST" && url === "/api/cache/clear") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    responseCache.clear();
    return sendJson(res, 200, { ok: true, message: "Cache cleared" }), true;
  }

  return false; // not a metrics route
};
