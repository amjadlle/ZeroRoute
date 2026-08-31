/**
 * API key management routes — /api/keys
 *
 * GET    /api/keys     List all providers with their key status (configured/not)
 * POST   /api/keys     Save (or update) an encrypted API key for a provider
 * DELETE /api/keys/:id Remove an API key for a provider
 *
 * All routes require ADMIN_KEY authentication.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { providers }              from "../providers/providers.js";
import { isProviderConfigured, setProviderApiKey, deleteProviderApiKey, getProviderCredentialsStatus } from "../services/secrets.js";
import { isAuthorized }           from "../middleware/auth.js";
import { runtimeStateMap }        from "../providers/state.js";
import { sendJson, parseBody }    from "../utils/http.js";

const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ROUTER_API_KEY;

export const handleKeysRoutes = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> => {

  // GET /api/keys
  if (req.method === "GET" && url === "/api/keys") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    const keysStatus = providers.map(p => ({
      id:    p.id,
      name:  p.name,
      model: p.model,
      ...getProviderCredentialsStatus(p.id)
    }));
    return sendJson(res, 200, keysStatus), true;
  }

  // POST /api/keys
  if (req.method === "POST" && url === "/api/keys") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    try {
      const raw  = await parseBody(req);
      const body = JSON.parse(raw) as { providerId: string; apiKey: string };
      if (!body.providerId || typeof body.apiKey !== "string") {
        return sendJson(res, 400, { error: "providerId and apiKey required" }), true;
      }
      setProviderApiKey(body.providerId, body.apiKey);
      const state = runtimeStateMap.get(body.providerId);
      if (state) state.configured = isProviderConfigured(body.providerId);
      return sendJson(res, 200, { ok: true, ...getProviderCredentialsStatus(body.providerId) }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" }), true;
    }
  }

  // DELETE /api/keys/:id
  if (req.method === "DELETE" && url.startsWith("/api/keys/")) {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
    }
    const id    = url.split("/")[3];
    deleteProviderApiKey(id);
    const state = runtimeStateMap.get(id);
    if (state) state.configured = isProviderConfigured(id);
    return sendJson(res, 200, { ok: true, id, configured: false }), true;
  }

  return false; // not a keys route
};
