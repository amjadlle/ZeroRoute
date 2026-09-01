/**
 * Health check route — GET /health
 *
 * Public endpoint (no auth). Returns only aggregate counters,
 * no internal details or API keys.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { metricsLogger } from "../services/metrics.js";
import { sendJson } from "../utils/http.js";

export const handleHealth = (_req: IncomingMessage, res: ServerResponse): void => {
  const stats = metricsLogger.getStats();
  sendJson(res, 200, {
    status: "ok",
    version: "0.1.2",
    uptime: Math.floor(process.uptime()),
    requests: {
      total:      stats.totalRequests,
      successful: stats.successfulRequests,
      failed:     stats.failedRequests,
      cacheHits:  stats.cacheHits
    }
  });
};
