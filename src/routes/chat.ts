/**
 * Chat completions gateway — /v1/chat/completions & /v1/models
 *
 * This is the core of ZeroRoute: it implements automatic failover across
 * all configured AI providers with streaming support and response caching.
 *
 * POST /v1/chat/completions  OpenAI-compatible chat endpoint
 * GET  /v1/models            List available models (OpenAI-compatible)
 */
import { randomUUID }     from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAuthorized, isRateLimited, getClientIp } from "../middleware/auth.js";
import { getEligibleProviders, getRuntimeProviders, TIMEOUT_MS, COOLDOWN_MS } from "../providers/state.js";
import { metricsLogger }  from "../services/metrics.js";
import { responseCache }  from "../services/cache.js";
import { KnowledgeStore }  from "../services/knowledge.js";
import { buildDynamicSystemPrompt } from "../services/prompt.js";
import { sendJson, parseBody, getCorsHeaders } from "../utils/http.js";
import type { ChatRequest, ChatResponse } from "../providers/types.js";

const ROUTER_API_KEY = process.env.ROUTER_API_KEY;

const getPromptPreview = (body: ChatRequest): string => {
  const lastUser = [...body.messages].reverse().find(m => m.role === "user");
  return lastUser?.content?.slice(0, 100) ?? body.messages[0]?.content?.slice(0, 100) ?? "No message";
};

export const handleChatRoutes = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> => {

  // GET /v1/models
  if (req.method === "GET" && url === "/v1/models") {
    if (!isAuthorized(req, ROUTER_API_KEY, true)) {
      return sendJson(res, 401, { error: { message: "Unauthorized: Invalid router API key" } }), true;
    }
    const modelList = getRuntimeProviders()
      .filter(p => p.enabled)
      .map(p => ({
        id:         p.model,
        object:     "model",
        created:    1700000000,
        owned_by:   p.id,
        permission: [],
        root:       p.model,
        parent:     null
      }));
    return sendJson(res, 200, { object: "list", data: modelList }), true;
  }

  // POST /v1/chat/completions
  if (req.method === "POST" && url === "/v1/chat/completions") {
    if (!isAuthorized(req, ROUTER_API_KEY, true)) {
      return sendJson(res, 401, { error: { message: "Invalid router API key" } }), true;
    }

    // Rate limit: 60 requests/min per IP
    if (isRateLimited(getClientIp(req), 60)) {
      return sendJson(res, 429, { error: { message: "Rate limit exceeded. Try again later." } }), true;
    }

    let body: ChatRequest;
    try {
      const raw = await parseBody(req);
      body = JSON.parse(raw);
    } catch (error) {
      return sendJson(res, 400, { error: { message: error instanceof Error ? error.message : "Invalid JSON request" } }), true;
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return sendJson(res, 400, { error: { message: "messages must be a non-empty array" } }), true;
    }

    const startReqTime = Date.now();
    const reqOrigin = (req.headers.origin as string) || (req.headers.referer as string) || "Direct API";
    const promptPreview = getPromptPreview(body);

    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    const callerCustomerKey = bearerToken.startsWith("zr_live_") ? bearerToken : undefined;

    // ── Dynamic System Prompt & Knowledge Base Context Injection ─────────
    const lastUserQuery = [...body.messages].reverse().find(m => m.role === "user")?.content || "";
    const knowledgeContext = KnowledgeStore.retrieveContext(lastUserQuery, 6000, callerCustomerKey);

    const existingSystemMsg = body.messages.find(m => m.role === "system");
    const customUserPersona = existingSystemMsg ? existingSystemMsg.content : undefined;

    // Only apply widget persona wrap if using knowledge or when caller is a widget/customer
    let dynamicSystemContent = customUserPersona || "";
    if (knowledgeContext || callerCustomerKey) {
      dynamicSystemContent = buildDynamicSystemPrompt({
        knowledgeContext,
        customPersona: customUserPersona
      });
    }

    if (dynamicSystemContent) {
      if (existingSystemMsg) {
        body.messages = body.messages.map(m =>
          m.role === "system" ? { ...m, content: dynamicSystemContent } : m
        );
      } else {
        body.messages = [
          { role: "system", content: dynamicSystemContent },
          ...body.messages
        ];
      }
    }

    const cacheKey  = responseCache.generateKey(body);
    const cached    = responseCache.get(cacheKey);

    // ── 1. Cache hit ────────────────────────────────────────────────────────
    if (cached) {
      const latencyMs = Date.now() - startReqTime;
      metricsLogger.log({
        id:              cached.id,
        timestamp:       Date.now(),
        customerKey:     callerCustomerKey,
        origin:          reqOrigin,
        promptPreview,
        responsePreview: cached.choices[0].message.content.slice(0, 100),
        provider:        "cache (" + cached.provider + ")",
        model:           cached.model,
        latencyMs,
        status:          200,
        isStream:        Boolean(body.stream),
        isCacheHit:      true,
        failovers:       [],
        tokens:          cached.usage
      });

      if (body.stream) {
        res.writeHead(200, {
          "Content-Type":  "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection:      "keep-alive",
          "X-Cache":       "HIT",
          ...getCorsHeaders(req.headers.origin as string | undefined)
        });
        for await (const chunk of responseCache.streamCachedResponse(cached)) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write("data: [DONE]\n\n");
        return res.end(), true;
      }

      return sendJson(res, 200, cached, { "X-Cache": "HIT" }), true;
    }

    const candidates = getEligibleProviders(body.model);
    if (candidates.length === 0) {
      return sendJson(res, 503, { error: { message: "No enabled providers configured in router" } }), true;
    }

    const failures: string[] = [];

    // ── 2. Streaming mode ───────────────────────────────────────────────────
    if (body.stream) {
      for (const { state, provider } of candidates) {
        const start = Date.now();
        try {
          const streamIterable = await provider.generateStream(body, AbortSignal.timeout(TIMEOUT_MS));
          const iterator = streamIterable[Symbol.asyncIterator]();
          const first    = await iterator.next();

          if (first.done) throw new Error(`${provider.id} returned an empty stream`);

          res.writeHead(200, {
            "Content-Type":  "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection:      "keep-alive",
            "X-Cache":       "MISS",
            ...getCorsHeaders(req.headers.origin as string | undefined)
          });
          res.write(`data: ${JSON.stringify(first.value)}\n\n`);

          state.consecutiveFailures = 0;
          state.cooldownUntil       = 0;
          state.lastLatencyMs       = Date.now() - start;

          let fullContent = first.value.choices[0]?.delta?.content ?? "";
          for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
            fullContent += chunk.choices[0]?.delta?.content ?? "";
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          res.end();

          // Cache reconstructed response for future identical requests
          const reconstructed: ChatResponse = {
            id:      first.value.id,
            object:  "chat.completion",
            created: Math.floor(Date.now() / 1000),
            provider: provider.id,
            model:   provider.model,
            choices: [{ index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" }]
          };
          responseCache.set(cacheKey, reconstructed);

          metricsLogger.log({
            id:              first.value.id,
            timestamp:       Date.now(),
            customerKey:     callerCustomerKey,
            origin:          reqOrigin,
            promptPreview,
            responsePreview: fullContent.slice(0, 100),
            provider:        provider.id,
            model:           provider.model,
            latencyMs:       Date.now() - startReqTime,
            status:          200,
            isStream:        true,
            isCacheHit:      false,
            failovers:       [...failures]
          });

          return true;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : "Streaming failed";
          state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
          state.cooldownUntil       = Date.now() + COOLDOWN_MS;
          state.lastError           = errMsg;
          failures.push(`${provider.id}: ${errMsg}`);
        }
      }

      // All streaming providers failed
      const totalLatency = Date.now() - startReqTime;
      console.error("[ZeroRoute] All streaming providers failed:", failures);
      metricsLogger.log({
        id: randomUUID(), timestamp: Date.now(), customerKey: callerCustomerKey, origin: reqOrigin, promptPreview,
        provider: "none", model: "none", latencyMs: totalLatency,
        status: 502, isStream: true, isCacheHit: false, failovers: [...failures]
      });
      return sendJson(res, 502, {
        error: { message: "All configured providers failed. Please try again later.", request_id: randomUUID() }
      }), true;
    }

    // ── 3. Non-streaming mode ───────────────────────────────────────────────
    for (const { state, provider } of candidates) {
      const start = Date.now();
      try {
        const result    = await provider.generate(body, AbortSignal.timeout(TIMEOUT_MS));
        const latencyMs = Date.now() - start;
        state.consecutiveFailures = 0;
        state.cooldownUntil       = 0;
        state.lastLatencyMs       = latencyMs;

        responseCache.set(cacheKey, result);

        metricsLogger.log({
          id:              result.id,
          timestamp:       Date.now(),
          customerKey:     callerCustomerKey,
          origin:          reqOrigin,
          promptPreview,
          responsePreview: result.choices[0]?.message?.content?.slice(0, 100),
          provider:        provider.id,
          model:           result.model,
          latencyMs:       Date.now() - startReqTime,
          status:          200,
          isStream:        false,
          isCacheHit:      false,
          failovers:       [...failures],
          tokens:          result.usage
        });

        return sendJson(res, 200, result, { "X-Cache": "MISS" }), true;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Request failed";
        state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
        state.cooldownUntil       = Date.now() + COOLDOWN_MS;
        state.lastError           = errMsg;
        failures.push(`${provider.id}: ${errMsg}`);
      }
    }

    // All non-streaming providers failed
    const totalLatency = Date.now() - startReqTime;
    console.error("[ZeroRoute] All non-streaming providers failed:", failures);
    metricsLogger.log({
      id: randomUUID(), timestamp: Date.now(), promptPreview,
      provider: "none", model: "none", latencyMs: totalLatency,
      status: 502, isStream: false, isCacheHit: false, failovers: [...failures]
    });
    return sendJson(res, 502, {
      error: { message: "All configured providers failed. Please try again later.", request_id: randomUUID() }
    }), true;
  }

  return false; // not a chat route
};
