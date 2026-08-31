/**
 * Provider management routes — /api/providers & /api/providers/:id/test
 *
 * GET  /api/providers          List current provider state
 * PUT  /api/providers          Update enabled/order/model settings
 * POST /api/providers/:id/test Ping a specific provider (rate-limited)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { providers }                 from "../providers/providers.js";
import { saveConfig }                from "../services/config.js";
import { isAuthorized, isRateLimited, getClientIp } from "../middleware/auth.js";
import { runtimeStateMap, getRuntimeProviders, TIMEOUT_MS } from "../providers/state.js";
import { sendJson, parseBody }       from "../utils/http.js";
import type { PersistedProviderConfig } from "../services/config.js";

const ADMIN_KEY    = process.env.ADMIN_KEY    || process.env.ROUTER_API_KEY;

export const handleProvidersRoutes = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> => {

  // GET /api/providers
  if (req.method === "GET" && url === "/api/providers") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    return sendJson(res, 200, getRuntimeProviders()), true;
  }

  // PUT /api/providers
  if (req.method === "PUT" && url === "/api/providers") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    try {
      const raw  = await parseBody(req);
      const body = JSON.parse(raw) as { providers: PersistedProviderConfig[] };
      if (!Array.isArray(body.providers)) {
        return sendJson(res, 400, { error: "Invalid payload: providers array expected" }), true;
      }

      body.providers.forEach((item, index) => {
        const existing = runtimeStateMap.get(item.id);
        if (!existing) return;
        existing.enabled = Boolean(item.enabled);
        existing.order   = typeof item.order === "number" ? item.order : index + 1;
        if (item.model && typeof item.model === "string" && item.model.trim()) {
          existing.model = item.model.trim();
          const p = providers.find(x => x.id === item.id);
          if (p) p.model = item.model.trim();
        }
      });

      saveConfig({
        providers: getRuntimeProviders().map(p => ({ id: p.id, enabled: p.enabled, order: p.order, model: p.model }))
      });

      return sendJson(res, 200, getRuntimeProviders()), true;
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" }), true;
    }
  }

  // POST /api/providers/:id/test
  if (req.method === "POST" && url.startsWith("/api/providers/") && url.endsWith("/test")) {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    // Rate limit: 10 test calls/min per IP
    if (isRateLimited(getClientIp(req), 10)) {
      return sendJson(res, 429, { error: "Rate limit exceeded for provider tests." }), true;
    }

    const id       = url.split("/")[3];
    const provider = providers.find(p => p.id === id);
    const state    = runtimeStateMap.get(id);
    if (!provider || !state) {
      return sendJson(res, 404, { error: "Unknown provider" }), true;
    }

    const start = Date.now();
    try {
      const result    = await provider.generate(
        { messages: [{ role: "user", content: "Reply with the word OK." }] },
        AbortSignal.timeout(TIMEOUT_MS)
      );
      const latencyMs = Date.now() - start;
      state.lastLatencyMs       = latencyMs;
      state.consecutiveFailures = 0;
      state.cooldownUntil       = 0;
      return sendJson(res, 200, { ok: true, provider: result.provider, model: result.model, latencyMs }), true;
    } catch (error) {
      const latencyMs = Date.now() - start;
      const msg       = error instanceof Error ? error.message : "Provider test failed";
      state.lastError             = msg;
      state.consecutiveFailures   = (state.consecutiveFailures || 0) + 1;
      return sendJson(res, 502, { ok: false, error: msg, latencyMs }), true;
    }
  }

  return false; // not a provider route
};
