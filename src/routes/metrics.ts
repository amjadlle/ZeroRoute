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

import { CustomerStore } from "../services/customers.js";

const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ROUTER_API_KEY;

export const handleMetricsRoutes = (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): boolean => {

  // GET /api/metrics
  if (req.method === "GET" && url === "/api/metrics") {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();

    const isAdmin = Boolean(ADMIN_KEY && token === ADMIN_KEY);
    const isCustomer = token.startsWith("zr_live_") && CustomerStore.isValid(token);

    if (!isAdmin && !isCustomer) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin or customer key" }), true;
    }

    const allLogs = metricsLogger.getLogs();
    const allStats = metricsLogger.getStats();

    // If customer, filter strictly to requests with their key
    if (isCustomer) {
      const customerLogs = allLogs.filter(l => l.customerKey === token);
      const successful = customerLogs.filter(l => l.status >= 200 && l.status < 300);
      const totalTokens = customerLogs.reduce((sum, l) => sum + (l.tokens?.total_tokens || 0), 0);
      const latencySum = successful.reduce((sum, l) => sum + l.latencyMs, 0);

      const customerStats = {
        totalRequests: customerLogs.length,
        cacheHits: customerLogs.filter(l => l.isCacheHit).length,
        totalTokens,
        savedTokens: 0,
        estimatedSavingsUsd: "$0.0000",
        avgLatencyMs: successful.length > 0 ? Math.round(latencySum / successful.length) : 0,
        successfulRequests: successful.length,
        failedRequests: customerLogs.length - successful.length,
        origins: {},
        providers: {},
        models: {}
      };

      return sendJson(res, 200, {
        stats: customerStats,
        logs: customerLogs,
        cacheSize: responseCache.size()
      }), true;
    }

    // Admin receives all logs & stats
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
