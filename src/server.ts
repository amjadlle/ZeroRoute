import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { providers } from "./providers.js";
import { dashboardHtml } from "./dashboard.js";
import { landingHtml, getLandingHtml } from "./landing.js";
import { loadConfig, saveConfig, PersistedProviderConfig } from "./config.js";
import { responseCache } from "./cache.js";
import { metricsLogger } from "./metrics.js";
import { isProviderConfigured, setProviderApiKey, deleteProviderApiKey, getProviderCredentialsStatus } from "./secrets.js";
import type { ChatRequest, ChatResponse, ProviderRuntimeState } from "./types.js";

const port = Number(process.env.PORT ?? 8787);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 8000);
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 60000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
const ROUTER_API_KEY = process.env.ROUTER_API_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY || process.env.ROUTER_API_KEY;

const configuredOrder = (process.env.PROVIDER_ORDER ?? "sambanova,groq,mistral,openrouter,gemini,nvidia,cloudflare,cohere")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

// Initialize runtime state from saved config or defaults
const persisted = loadConfig();
const runtimeStateMap = new Map<string, ProviderRuntimeState>();

providers.forEach((p, idx) => {
  const persistedEntry = persisted?.providers.find(x => x.id === p.id);
  const defaultOrder = configuredOrder.includes(p.id) ? configuredOrder.indexOf(p.id) + 1 : idx + 10;
  if (persistedEntry?.model) {
    p.model = persistedEntry.model;
  }
  runtimeStateMap.set(p.id, {
    id: p.id,
    name: p.name,
    model: p.model,
    enabled: persistedEntry ? persistedEntry.enabled : true,
    order: persistedEntry ? persistedEntry.order : defaultOrder,
    configured: isProviderConfigured(p.id),
    consecutiveFailures: 0,
    cooldownUntil: 0
  });
});

const getRuntimeProviders = (): ProviderRuntimeState[] => {
  return Array.from(runtimeStateMap.values())
    .map(p => {
      p.configured = isProviderConfigured(p.id);
      return p;
    })
    .sort((a, b) => a.order - b.order);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400"
};

const sendJson = (res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders,
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
};

const parseBody = (req: IncomingMessage, maxSize = 2 * 1024 * 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        reject(new Error("Payload too large (max 2MB)"));
        return;
      }
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
};

const isAuthorized = (req: IncomingMessage, secretKey?: string): boolean => {
  if (!secretKey || secretKey === "change-me") return true;
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  return authHeader === `Bearer ${secretKey}` || authHeader === secretKey;
};

const getEligibleProviders = (requestedTarget?: string) => {
  const all = getRuntimeProviders().filter(p => p.enabled);
  const now = Date.now();
  const ready = all.filter(p => !p.cooldownUntil || p.cooldownUntil <= now);
  const cooling = all.filter(p => p.cooldownUntil && p.cooldownUntil > now);
  cooling.sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  const ordered = [...ready, ...cooling]
    .map(p => ({ state: p, provider: providers.find(x => x.id === p.id)! }))
    .filter(x => Boolean(x.provider));

  if (requestedTarget && requestedTarget !== "auto" && requestedTarget !== "default") {
    const targetIdx = ordered.findIndex(
      x => x.provider.id === requestedTarget || x.provider.model.toLowerCase() === requestedTarget.toLowerCase()
    );
    if (targetIdx !== -1) {
      const target = ordered.splice(targetIdx, 1)[0];
      return [target, ...ordered];
    }
  }

  return ordered;
};

const getPromptPreview = (body: ChatRequest): string => {
  const lastUser = [...body.messages].reverse().find(m => m.role === "user");
  return lastUser?.content?.slice(0, 100) ?? body.messages[0]?.content?.slice(0, 100) ?? "No message";
};

import { widgetJs } from "./widget.js";

export const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  const url = req.url?.split("?")[0] ?? "/";

  // Static Logo Asset
  if (req.method === "GET" && (url === "/logo.png" || url === "/public/logo.png")) {
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        const img = fs.readFileSync(logoPath);
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", ...corsHeaders });
        return res.end(img);
      }
    } catch {}
  }

  // Embeddable Website Chatbot Widget Script
  if (req.method === "GET" && url === "/widget.js") {
    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", ...corsHeaders });
    return res.end(widgetJs);
  }

  // Public Marketing Landing Page
  if (req.method === "GET" && url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...corsHeaders });
    return res.end(getLandingHtml(ROUTER_API_KEY));
  }

  // Administrative Gateway Console / Dashboard UI
  if (req.method === "GET" && (url === "/app" || url === "/dashboard" || url === "/console" || url === "/admin")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...corsHeaders });
    return res.end(dashboardHtml);
  }


  // Health check
  if (req.method === "GET" && url === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      uptime: Math.floor(process.uptime()),
      cacheSize: responseCache.size(),
      stats: metricsLogger.getStats(),
      providers: getRuntimeProviders()
    });
  }

  // List Models (OpenAI compatible)
  if (req.method === "GET" && url === "/v1/models") {
    if (!isAuthorized(req, ROUTER_API_KEY)) {
      return sendJson(res, 401, { error: { message: "Unauthorized: Invalid router API key" } });
    }
    const modelList = getRuntimeProviders()
      .filter(p => p.enabled)
      .map(p => ({
        id: p.model,
        object: "model",
        created: 1700000000,
        owned_by: p.id,
        permission: [],
        root: p.model,
        parent: null
      }));
    return sendJson(res, 200, { object: "list", data: modelList });
  }

  // Provider Settings API
  if (req.method === "GET" && url === "/api/providers") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    return sendJson(res, 200, getRuntimeProviders());
  }

  if (req.method === "PUT" && url === "/api/providers") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as { providers: PersistedProviderConfig[] };
      if (!Array.isArray(body.providers)) {
        return sendJson(res, 400, { error: "Invalid payload: providers array expected" });
      }

      body.providers.forEach((item, index) => {
        const existing = runtimeStateMap.get(item.id);
        if (existing) {
          existing.enabled = Boolean(item.enabled);
          existing.order = typeof item.order === "number" ? item.order : index + 1;
          if (item.model && typeof item.model === "string" && item.model.trim()) {
            existing.model = item.model.trim();
            const p = providers.find(x => x.id === item.id);
            if (p) p.model = item.model.trim();
          }
        }
      });

      saveConfig({
        providers: getRuntimeProviders().map(p => ({ id: p.id, enabled: p.enabled, order: p.order, model: p.model }))
      });

      return sendJson(res, 200, getRuntimeProviders());
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" });
    }
  }

  // Metrics & Request Logs API
  if (req.method === "GET" && url === "/api/metrics") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    return sendJson(res, 200, {
      stats: metricsLogger.getStats(),
      logs: metricsLogger.getLogs(),
      cacheSize: responseCache.size()
    });
  }

  if (req.method === "DELETE" && url === "/api/metrics/logs") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    metricsLogger.clear();
    return sendJson(res, 200, { ok: true, message: "Logs cleared" });
  }

  if (req.method === "POST" && url === "/api/cache/clear") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    responseCache.clear();
    return sendJson(res, 200, { ok: true, message: "Cache cleared" });
  }

  // Credentials & API Key Management API
  if (req.method === "GET" && url === "/api/keys") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    const keysStatus = providers.map(p => ({
      id: p.id,
      name: p.name,
      model: p.model,
      ...getProviderCredentialsStatus(p.id)
    }));
    return sendJson(res, 200, keysStatus);
  }

  if (req.method === "POST" && url === "/api/keys") {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as { providerId: string; apiKey: string };
      if (!body.providerId || typeof body.apiKey !== "string") {
        return sendJson(res, 400, { error: "providerId and apiKey required" });
      }

      setProviderApiKey(body.providerId, body.apiKey);
      const state = runtimeStateMap.get(body.providerId);
      if (state) {
        state.configured = isProviderConfigured(body.providerId);
      }
      return sendJson(res, 200, { ok: true, ...getProviderCredentialsStatus(body.providerId) });
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" });
    }
  }

  if (req.method === "DELETE" && url.startsWith("/api/keys/")) {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    const id = url.split("/")[3];
    deleteProviderApiKey(id);
    const state = runtimeStateMap.get(id);
    if (state) {
      state.configured = isProviderConfigured(id);
    }
    return sendJson(res, 200, { ok: true, id, configured: false });
  }

  // Provider Connectivity Test
  if (req.method === "POST" && url.startsWith("/api/providers/") && url.endsWith("/test")) {
    if (!isAuthorized(req, ADMIN_KEY)) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" });
    }
    const id = url.split("/")[3];
    const provider = providers.find(p => p.id === id);
    const state = runtimeStateMap.get(id);
    if (!provider || !state) {
      return sendJson(res, 404, { error: "Unknown provider" });
    }

    const start = Date.now();
    try {
      const result = await provider.generate(
        { messages: [{ role: "user", content: "Reply with the word OK." }] },
        AbortSignal.timeout(TIMEOUT_MS)
      );
      const latencyMs = Date.now() - start;
      state.lastLatencyMs = latencyMs;
      state.consecutiveFailures = 0;
      state.cooldownUntil = 0;
      return sendJson(res, 200, { ok: true, provider: result.provider, model: result.model, latencyMs });
    } catch (error) {
      const latencyMs = Date.now() - start;
      const msg = error instanceof Error ? error.message : "Provider test failed";
      state.lastError = msg;
      state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
      return sendJson(res, 502, { ok: false, error: msg, latencyMs });
    }
  }

  // Main Chat Completions Gateway
  if (req.method === "POST" && url === "/v1/chat/completions") {
    if (!isAuthorized(req, ROUTER_API_KEY)) {
      return sendJson(res, 401, { error: { message: "Invalid router API key" } });
    }

    let body: ChatRequest;
    try {
      const raw = await parseBody(req);
      body = JSON.parse(raw);
    } catch (error) {
      return sendJson(res, 400, { error: { message: error instanceof Error ? error.message : "Invalid JSON request" } });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return sendJson(res, 400, { error: { message: "messages must be a non-empty array" } });
    }

    const startReqTime = Date.now();
    const promptPreview = getPromptPreview(body);
    const cacheKey = responseCache.generateKey(body);
    const cached = responseCache.get(cacheKey);

    // 1. Handle Cache Hit
    if (cached) {
      const latencyMs = Date.now() - startReqTime;
      metricsLogger.log({
        id: cached.id,
        timestamp: Date.now(),
        promptPreview,
        responsePreview: cached.choices[0].message.content.slice(0, 100),
        provider: "cache (" + cached.provider + ")",
        model: cached.model,
        latencyMs,
        status: 200,
        isStream: Boolean(body.stream),
        isCacheHit: true,
        failovers: [],
        tokens: cached.usage
      });

      if (body.stream) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Cache": "HIT",
          ...corsHeaders
        });

        for await (const chunk of responseCache.streamCachedResponse(cached)) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        return res.end();
      }

      return sendJson(res, 200, cached, { "X-Cache": "HIT" });
    }

    const candidates = getEligibleProviders(body.model);
    if (candidates.length === 0) {
      return sendJson(res, 503, { error: { message: "No enabled providers configured in router" } });
    }

    const failures: string[] = [];

    // 2. Streaming response mode
    if (body.stream) {
      for (const { state, provider } of candidates) {
        const start = Date.now();
        try {
          const streamIterable = await provider.generateStream(body, AbortSignal.timeout(TIMEOUT_MS));
          const iterator = streamIterable[Symbol.asyncIterator]();
          const first = await iterator.next();

          if (first.done) {
            throw new Error(`${provider.id} returned an empty stream`);
          }

          // Successfully started stream!
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Cache": "MISS",
            ...corsHeaders
          });

          res.write(`data: ${JSON.stringify(first.value)}\n\n`);

          state.consecutiveFailures = 0;
          state.cooldownUntil = 0;
          state.lastLatencyMs = Date.now() - start;

          let fullContent = first.value.choices[0]?.delta?.content ?? "";

          for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
            fullContent += chunk.choices[0]?.delta?.content ?? "";
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          res.write("data: [DONE]\n\n");
          res.end();

          const latencyMs = Date.now() - startReqTime;

          // Save reconstructed response in cache
          const reconstructed: ChatResponse = {
            id: first.value.id,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            provider: provider.id,
            model: provider.model,
            choices: [{ index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" }]
          };
          responseCache.set(cacheKey, reconstructed);

          metricsLogger.log({
            id: first.value.id,
            timestamp: Date.now(),
            promptPreview,
            responsePreview: fullContent.slice(0, 100),
            provider: provider.id,
            model: provider.model,
            latencyMs,
            status: 200,
            isStream: true,
            isCacheHit: false,
            failovers: [...failures]
          });

          return;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Streaming failed";
          state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
          state.cooldownUntil = Date.now() + COOLDOWN_MS;
          state.lastError = errMsg;
          failures.push(`${provider.id}: ${errMsg}`);
        }
      }

      const totalLatency = Date.now() - startReqTime;
      metricsLogger.log({
        id: randomUUID(),
        timestamp: Date.now(),
        promptPreview,
        provider: "none",
        model: "none",
        latencyMs: totalLatency,
        status: 502,
        isStream: true,
        isCacheHit: false,
        failovers: [...failures]
      });

      return sendJson(res, 502, {
        error: {
          message: "All configured providers failed",
          details: failures,
          request_id: randomUUID()
        }
      });
    }

    // 3. Non-streaming response mode
    for (const { state, provider } of candidates) {
      const start = Date.now();
      try {
        const result = await provider.generate(body, AbortSignal.timeout(TIMEOUT_MS));
        const latencyMs = Date.now() - start;
        state.consecutiveFailures = 0;
        state.cooldownUntil = 0;
        state.lastLatencyMs = latencyMs;

        responseCache.set(cacheKey, result);

        metricsLogger.log({
          id: result.id,
          timestamp: Date.now(),
          promptPreview,
          responsePreview: result.choices[0]?.message?.content?.slice(0, 100),
          provider: provider.id,
          model: result.model,
          latencyMs: Date.now() - startReqTime,
          status: 200,
          isStream: false,
          isCacheHit: false,
          failovers: [...failures],
          tokens: result.usage
        });

        return sendJson(res, 200, result, { "X-Cache": "MISS" });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Request failed";
        state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
        state.cooldownUntil = Date.now() + COOLDOWN_MS;
        state.lastError = errMsg;
        failures.push(`${provider.id}: ${errMsg}`);
      }
    }

    const totalLatency = Date.now() - startReqTime;
    metricsLogger.log({
      id: randomUUID(),
      timestamp: Date.now(),
      promptPreview,
      provider: "none",
      model: "none",
      latencyMs: totalLatency,
      status: 502,
      isStream: false,
      isCacheHit: false,
      failovers: [...failures]
    });

    return sendJson(res, 502, {
      error: {
        message: "All configured providers failed",
        details: failures,
        request_id: randomUUID()
      }
    });
  }

  // 404 Fallback
  return sendJson(res, 404, { error: { message: "Not found" } });
};

// Self-Healing Background Heartbeat for cooling providers
function startSelfHealingHeartbeat() {
  setInterval(async () => {
    const now = Date.now();
    for (const p of providers) {
      const state = runtimeStateMap.get(p.id);
      if (state && state.configured && state.cooldownUntil && state.cooldownUntil <= now) {
        // Cooldown has elapsed - probe health to auto-recover
        try {
          const timeout = AbortSignal.timeout(6000);
          await p.generate({
            messages: [{ role: "user", content: "Ping" }],
            max_tokens: 3,
            temperature: 0.1
          }, timeout);
          state.consecutiveFailures = 0;
          state.cooldownUntil = 0;
          state.lastError = undefined;
          console.log(`💚 [Auto-Heal] Provider ${p.id} recovered and restored to active routing pool`);
        } catch {
          // Still failing, extend cooldown
          state.cooldownUntil = Date.now() + COOLDOWN_MS;
        }
      }
    }
  }, 30000);
}

// Start standalone HTTP server when run directly (local / docker / VPS)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
if (!isServerless) {
  startSelfHealingHeartbeat();
  createServer(handleRequest).listen(port, () => {
    console.log(`⚡ ZeroRoute listening on http://localhost:${port}`);
  });
}

export default handleRequest;
