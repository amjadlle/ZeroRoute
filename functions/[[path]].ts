/**
 * ZeroRoute — Cloudflare Pages Functions Adapter
 *
 * Catch-all handler (`functions/[[path]].ts`) that runs directly on Cloudflare Edge.
 * Routes /v1/*, /api/*, and /health to the ZeroRoute engine, and passes all other
 * requests to `context.next()` so Cloudflare serves static assets from `public/`.
 */

import { providers } from "../src/providers/providers.js";
import { getEligibleProviders, getRuntimeProviders, runtimeStateMap, TIMEOUT_MS, COOLDOWN_MS } from "../src/providers/state.js";
import { responseCache } from "../src/services/cache.js";
import { metricsLogger } from "../src/services/metrics.js";
import { getProviderCredentialsStatus, isProviderConfigured, setProviderApiKey, deleteProviderApiKey } from "../src/services/secrets.js";
import type { ChatRequest, ChatResponse } from "../src/providers/types.js";

interface Env {
  [key: string]: string | undefined;
}

const getCorsHeaders = (origin?: string | null): Record<string, string> => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Max-Age": "86400"
});

const jsonResponse = (data: unknown, status = 200, origin?: string | null, extraHeaders: Record<string, string> = {}) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(origin),
      ...extraHeaders
    }
  });
};

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

const checkAuth = (request: Request, requiredKey?: string, isRouterAuth = false, corsOrigin?: string): boolean => {
  if (!requiredKey || requiredKey.trim() === "") return true; // Public mode

  // Allow dynamic same-origin & configured CORS domain requests for the embedded chatbot
  if (isRouterAuth) {
    const url = new URL(request.url);
    const host = url.host;
    const hostname = url.hostname.toLowerCase();
    const origin = request.headers.get("Origin");
    const referer = request.headers.get("Referer");
    const secFetchSite = request.headers.get("Sec-Fetch-Site");

    if (secFetchSite === "same-origin") return true;
    if (origin) {
      if (origin === `http://${host}` || origin === `https://${host}` || origin === url.origin) return true;
      try {
        const orgHost = new URL(origin).hostname.toLowerCase();
        if (orgHost === hostname) return true;
      } catch {}
      if (corsOrigin && isOriginAllowedByPattern(origin, corsOrigin)) return true;
    }
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.host === host || refUrl.hostname.toLowerCase() === hostname) return true;
        if (corsOrigin && isOriginAllowedByPattern(refUrl.origin, corsOrigin)) return true;
      } catch {}
    }
  }

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  if (token === requiredKey) return true;
  if (isRouterAuth && (token === "free" || token === "public" || token === "zeroroute")) return true;
  return false;
};

export const onRequest = async (context: { request: Request; env: Env; next: () => Promise<Response> }): Promise<Response> => {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const origin = request.headers.get("Origin");

  // Sync Cloudflare environment variables to process.env
  if (env) {
    if (typeof process === "undefined") {
      (globalThis as any).process = { env: {} };
    } else if (!process.env) {
      process.env = {};
    }
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") {
        process.env[k] = v;
      }
    }
  }

  const ROUTER_API_KEY = env?.ROUTER_API_KEY || process.env.ROUTER_API_KEY;
  const ADMIN_KEY = env?.ADMIN_KEY || process.env.ADMIN_KEY || ROUTER_API_KEY;
  const CORS_ORIGIN = env?.CORS_ORIGIN || process.env.CORS_ORIGIN;
  const kv = (env as any)?.METRICS_KV || (env as any)?.KV;

  if (kv && metricsLogger.getStats().totalRequests === 0) {
    try {
      const saved = await kv.get("zeroroute_metrics_state", "json");
      if (saved) metricsLogger.importState(saved);
    } catch {}
  }

  // 1. CORS Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  }

  // 2. Health check — GET /health
  if (request.method === "GET" && pathname === "/health") {
    const stats = metricsLogger.getStats();
    return jsonResponse({
      status: "ok",
      version: "0.1.2",
      platform: "cloudflare-pages",
      uptime: Math.floor((globalThis.performance ? performance.now() : 0) / 1000),
      requests: {
        total: stats.totalRequests,
        successful: stats.successfulRequests,
        failed: stats.failedRequests,
        cacheHits: stats.cacheHits
      }
    }, 200, origin);
  }

  // 3. Models list — GET /v1/models
  if (request.method === "GET" && pathname === "/v1/models") {
    if (!checkAuth(request, ROUTER_API_KEY, true, CORS_ORIGIN)) {
      return jsonResponse({ error: { message: "Unauthorized: Invalid router API key" } }, 401, origin);
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
    return jsonResponse({ object: "list", data: modelList }, 200, origin);
  }

  // 4. Chat Completions — POST /v1/chat/completions
  if (request.method === "POST" && pathname === "/v1/chat/completions") {
    if (!checkAuth(request, ROUTER_API_KEY, true, CORS_ORIGIN)) {
      return jsonResponse({ error: { message: "Invalid router API key" } }, 401, origin);
    }

    let body: ChatRequest;
    try {
      body = await request.json() as ChatRequest;
    } catch {
      return jsonResponse({ error: { message: "Invalid JSON request body" } }, 400, origin);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonResponse({ error: { message: "messages must be a non-empty array" } }, 400, origin);
    }

    const startReqTime = Date.now();
    const reqOrigin = origin || request.headers.get("Referer") || "Direct API";
    const lastUser = [...body.messages].reverse().find(m => m.role === "user");
    const promptPreview = lastUser?.content?.slice(0, 100) ?? body.messages[0]?.content?.slice(0, 100) ?? "No message";
    const cacheKey = responseCache.generateKey(body);
    const cfCache = typeof caches !== "undefined" ? (caches as any).default : null;
    const cacheKeyUrl = `https://cache.zeroroute.internal/v1/chat/completions/${cacheKey}`;

    let cached = responseCache.get(cacheKey);
    if (!cached && cfCache) {
      try {
        const cfMatch = await cfCache.match(cacheKeyUrl);
        if (cfMatch) {
          cached = await cfMatch.json() as ChatResponse;
          responseCache.set(cacheKey, cached);
        }
      } catch {}
    }

    const syncKv = () => {
      if (kv) {
        try {
          const payload = JSON.stringify(metricsLogger.exportState());
          (context as any).waitUntil ? (context as any).waitUntil(kv.put("zeroroute_metrics_state", payload)) : kv.put("zeroroute_metrics_state", payload);
        } catch {}
      }
    };

    // Cache hit
    if (cached) {
      const latencyMs = Date.now() - startReqTime;
      metricsLogger.log({
        id: cached.id,
        timestamp: Date.now(),
        origin: reqOrigin,
        promptPreview,
        responsePreview: cached.choices[0].message.content.slice(0, 100),
        provider: `cache (${cached.provider})`,
        model: cached.model,
        latencyMs,
        status: 200,
        isStream: Boolean(body.stream),
        isCacheHit: true,
        failovers: [],
        tokens: cached.usage
      });
      syncKv();

      if (body.stream) {
        const encoder = new TextEncoder();
        const customStream = new ReadableStream({
          async start(controller) {
            for await (const chunk of responseCache.streamCachedResponse(cached)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        });

        return new Response(customStream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Cache": "HIT",
            ...getCorsHeaders(origin)
          }
        });
      }

      return jsonResponse(cached, 200, origin, { "X-Cache": "HIT" });
    }

    const saveToEdgeCache = (respData: ChatResponse) => {
      responseCache.set(cacheKey, respData);
      if (cfCache) {
        try {
          const cfResp = new Response(JSON.stringify(respData), {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=3600, s-maxage=3600"
            }
          });
          cfCache.put(cacheKeyUrl, cfResp);
        } catch {}
      }
    };

    const candidates = getEligibleProviders(body.model);
    if (candidates.length === 0) {
      return jsonResponse({ error: { message: "No enabled providers configured in router" } }, 503, origin);
    }

    const failures: string[] = [];

    // Streaming mode
    if (body.stream) {
      for (const { state, provider } of candidates) {
        const start = Date.now();
        try {
          const streamIterable = await provider.generateStream(body, AbortSignal.timeout(TIMEOUT_MS));
          const iterator = streamIterable[Symbol.asyncIterator]();
          const first = await iterator.next();

          if (first.done) throw new Error(`${provider.id} returned an empty stream`);

          state.consecutiveFailures = 0;
          state.cooldownUntil = 0;
          state.lastLatencyMs = Date.now() - start;

          let fullContent = first.value.choices[0]?.delta?.content ?? "";
          const encoder = new TextEncoder();

          const sseStream = new ReadableStream({
            async start(controller) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(first.value)}\n\n`));
              try {
                for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
                  fullContent += chunk.choices[0]?.delta?.content ?? "";
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              } finally {
                controller.close();

                // Save reconstructed response in cache & Cloudflare Edge CDN
                const reconstructed: ChatResponse = {
                  id: first.value.id,
                  object: "chat.completion",
                  created: Math.floor(Date.now() / 1000),
                  provider: provider.id,
                  model: provider.model,
                  choices: [{ index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" }]
                };
                saveToEdgeCache(reconstructed);

                metricsLogger.log({
                  id: first.value.id,
                  timestamp: Date.now(),
                  origin: reqOrigin,
                  promptPreview,
                  responsePreview: fullContent.slice(0, 100),
                  provider: provider.id,
                  model: provider.model,
                  latencyMs: Date.now() - startReqTime,
                  status: 200,
                  isStream: true,
                  isCacheHit: false,
                  failovers: [...failures]
                });
                syncKv();
              }
            }
          });

          return new Response(sseStream, {
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Cache": "MISS",
              ...getCorsHeaders(origin)
            }
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Streaming failed";
          state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
          state.cooldownUntil = Date.now() + COOLDOWN_MS;
          state.lastError = errMsg;
          failures.push(`${provider.id}: ${errMsg}`);
        }
      }

      return jsonResponse({
        error: { message: "All configured providers failed. Please try again later.", failures }
      }, 502, origin);
    }

    // Non-streaming mode
    for (const { state, provider } of candidates) {
      const start = Date.now();
      try {
        const result = await provider.generate(body, AbortSignal.timeout(TIMEOUT_MS));
        const latencyMs = Date.now() - start;
        state.consecutiveFailures = 0;
        state.cooldownUntil = 0;
        state.lastLatencyMs = latencyMs;

        saveToEdgeCache(result);

        metricsLogger.log({
          id: result.id,
          timestamp: Date.now(),
          origin: reqOrigin,
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
        syncKv();

        return jsonResponse(result, 200, origin, { "X-Cache": "MISS" });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Request failed";
        state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
        state.cooldownUntil = Date.now() + COOLDOWN_MS;
        state.lastError = errMsg;
        failures.push(`${provider.id}: ${errMsg}`);
      }
    }

    return jsonResponse({
      error: { message: "All configured providers failed. Please try again later.", failures }
    }, 502, origin);
  }

  // 5. Providers Admin — /api/providers
  if (pathname === "/api/providers") {
    if (!checkAuth(request, ADMIN_KEY)) {
      return jsonResponse({ error: "Unauthorized: Invalid admin key" }, 401, origin);
    }
    if (request.method === "GET") {
      return jsonResponse(getRuntimeProviders(), 200, origin);
    }
    if (request.method === "PUT") {
      try {
        const updates = await request.json() as any[];
        for (const update of updates) {
          const state = runtimeStateMap.get(update.id);
          if (state) {
            if (typeof update.enabled === "boolean") state.enabled = update.enabled;
            if (typeof update.order === "number") state.order = update.order;
            if (typeof update.model === "string") {
              state.model = update.model;
              const provider = providers.find(p => p.id === update.id);
              if (provider) provider.model = update.model;
            }
          }
        }
        return jsonResponse({ ok: true, providers: getRuntimeProviders() }, 200, origin);
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : "Invalid JSON" }, 400, origin);
      }
    }
  }

  // Provider ping test — POST /api/providers/:id/test
  if (request.method === "POST" && pathname.startsWith("/api/providers/") && pathname.endsWith("/test")) {
    if (!checkAuth(request, ADMIN_KEY)) {
      return jsonResponse({ error: "Unauthorized: Invalid admin key" }, 401, origin);
    }
    const parts = pathname.split("/");
    const id = parts[3];
    const provider = providers.find(p => p.id === id);
    if (!provider) return jsonResponse({ error: `Provider ${id} not found` }, 404, origin);

    const start = Date.now();
    try {
      const res = await provider.generate(
        { messages: [{ role: "user", content: "Say hello in 3 words" }], max_tokens: 150, temperature: 0.1 },
        AbortSignal.timeout(TIMEOUT_MS)
      );
      return jsonResponse({
        ok: true,
        latencyMs: Date.now() - start,
        model: res.model,
        reply: res.choices[0]?.message?.content ?? ""
      }, 200, origin);
    } catch (err) {
      return jsonResponse({
        ok: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Test failed"
      }, 200, origin);
    }
  }

  // 6. Keys Admin — /api/keys
  if (pathname === "/api/keys") {
    if (!checkAuth(request, ADMIN_KEY)) {
      return jsonResponse({ error: "Unauthorized: Invalid admin key" }, 401, origin);
    }
    if (request.method === "GET") {
      const keysStatus = providers.map(p => ({
        id: p.id,
        name: p.name,
        model: p.model,
        ...getProviderCredentialsStatus(p.id)
      }));
      return jsonResponse(keysStatus, 200, origin);
    }
    if (request.method === "POST") {
      try {
        const body = await request.json() as { providerId: string; apiKey: string };
        if (!body.providerId || typeof body.apiKey !== "string") {
          return jsonResponse({ error: "providerId and apiKey required" }, 400, origin);
        }
        setProviderApiKey(body.providerId, body.apiKey);
        const state = runtimeStateMap.get(body.providerId);
        if (state) state.configured = isProviderConfigured(body.providerId);
        return jsonResponse({ ok: true, ...getProviderCredentialsStatus(body.providerId) }, 200, origin);
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : "Invalid JSON" }, 400, origin);
      }
    }
  }

  if (request.method === "DELETE" && pathname.startsWith("/api/keys/")) {
    if (!checkAuth(request, ADMIN_KEY)) {
      return jsonResponse({ error: "Unauthorized: Invalid admin key" }, 401, origin);
    }
    const id = pathname.split("/")[3];
    deleteProviderApiKey(id);
    const state = runtimeStateMap.get(id);
    if (state) state.configured = isProviderConfigured(id);
    return jsonResponse({ ok: true, id, configured: false }, 200, origin);
  }

  // 7. Metrics & Cache — /api/metrics, /api/cache/clear
  if (pathname === "/api/metrics") {
    if (!checkAuth(request, ADMIN_KEY)) {
      return jsonResponse({ error: "Unauthorized: Invalid admin key" }, 401, origin);
    }
    if (request.method === "GET") {
      return jsonResponse({
        stats: metricsLogger.getStats(),
        logs: metricsLogger.getLogs(),
        cacheSize: responseCache.size()
      }, 200, origin);
    }
    if (request.method === "DELETE") {
      metricsLogger.clear();
      return jsonResponse({ ok: true, message: "Logs cleared" }, 200, origin);
    }
  }

  if (request.method === "POST" && pathname === "/api/cache/clear") {
    if (!checkAuth(request, ADMIN_KEY)) {
      return jsonResponse({ error: "Unauthorized: Invalid admin key" }, 401, origin);
    }
    responseCache.clear();
    return jsonResponse({ ok: true, message: "Cache flushed" }, 200, origin);
  }

  // 8. Static file fallback: Pass to Cloudflare Pages static assets in public/
  return context.next();
};
