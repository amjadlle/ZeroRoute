/**
 * ZeroRoute — Entry point & request dispatcher.
 *
 * This file only wires routes together and starts the server.
 * All business logic lives in src/routes/ and src/middleware/.
 *
 * Route map:
 *   Static assets  → src/routes/static.ts
 *   GET  /health   → src/routes/health.ts
 *   /v1/*          → src/routes/chat.ts
 *   /api/providers → src/routes/providers.ts
 *   /api/keys      → src/routes/keys.ts
 *   /api/metrics   → src/routes/metrics.ts
 */
import { createServer }         from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { providers }            from "./providers/providers.js";
import { runtimeStateMap, COOLDOWN_MS, TIMEOUT_MS } from "./providers/state.js";
import { corsHeaders, getCorsHeaders, sendJson } from "./utils/http.js";
import { handleStaticRoutes }   from "./routes/static.js";
import { handleHealth }         from "./routes/health.js";
import { handleChatRoutes }     from "./routes/chat.js";
import { handleProvidersRoutes } from "./routes/providers.js";
import { handleKeysRoutes }     from "./routes/keys.js";
import { handleMetricsRoutes }  from "./routes/metrics.js";
import { handleKnowledgeRoutes } from "./routes/knowledge.js";
import { handleCustomerRoutes }  from "./routes/customers.js";

const port = Number(process.env.PORT ?? 8787);

// ─── Main request handler ─────────────────────────────────────────────────────

export const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, getCorsHeaders(req.headers.origin as string | undefined));
    res.end();
    return;
  }

  const url = req.url?.split("?")[0] ?? "/";

  // Dispatch to route handlers in priority order.
  // Each handler returns true if it handled the request, false to pass through.
  if (handleStaticRoutes(req, res, url))               return;
  if (req.method === "GET" && url === "/health")       { handleHealth(req, res); return; }
  if (await handleChatRoutes(req, res, url))           return;
  if (await handleProvidersRoutes(req, res, url))      return;
  if (await handleKeysRoutes(req, res, url))           return;
  if (await handleCustomerRoutes(req, res, url))       return;
  if (await handleKnowledgeRoutes(req, res, url))      return;
  if (handleMetricsRoutes(req, res, url))              return;

  // 404 fallback
  sendJson(res, 404, { error: { message: "Not found" } });
};

// ─── Self-healing heartbeat ───────────────────────────────────────────────────
// Probes providers that are in cooldown every 30 s.
// On success the provider is restored to the active routing pool automatically.

function startSelfHealingHeartbeat() {
  setInterval(async () => {
    const now = Date.now();
    for (const p of providers) {
      const state = runtimeStateMap.get(p.id);
      if (!state || !state.configured || !state.cooldownUntil || state.cooldownUntil > now) continue;

      try {
        await p.generate(
          { messages: [{ role: "user", content: "Ping" }], max_tokens: 3, temperature: 0.1 },
          AbortSignal.timeout(6000)
        );
        state.consecutiveFailures = 0;
        state.cooldownUntil       = 0;
        state.lastError           = undefined;
        console.log(`💚 [Auto-Heal] ${p.id} recovered and restored to active routing pool`);
      } catch {
        state.cooldownUntil = Date.now() + COOLDOWN_MS; // extend cooldown
      }
    }
  }, 30_000);
}

// ─── Server startup ───────────────────────────────────────────────────────────

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION ||
  typeof (globalThis as any).WebSocketPair !== "undefined" ||
  typeof (globalThis as any).caches !== "undefined" ||
  process.env.CLOUDFLARE_WORKER ||
  (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")
);

if (!isServerless && typeof process.versions?.node === "string") {
  startSelfHealingHeartbeat();
  createServer(handleRequest).listen(port, () => {
    console.log(`⚡ ZeroRoute listening on http://localhost:${port}`);
    if (!process.env.ROUTER_API_KEY) {
      console.warn("⚠️  [ZeroRoute] ROUTER_API_KEY is not set — gateway is in PUBLIC mode.");
    }
    if (!process.env.ADMIN_KEY && !process.env.ROUTER_API_KEY) {
      console.warn("⚠️  [ZeroRoute] ADMIN_KEY is not set — admin API endpoints are unprotected.");
    }
  });
}

export default handleRequest;
