import { createHash } from "node:crypto";
import type { ChatRequest, ChatResponse, ChatStreamChunk } from "../providers/types.js";

export type CacheEntry = {
  response: ChatResponse;
  expiresAt: number;
  createdAt: number;
};

const DEFAULT_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 60 * 60 * 1000); // 1 hour default
const MAX_CACHE_SIZE = Number(process.env.MAX_CACHE_ENTRIES ?? 1000);
const IS_CACHE_ENABLED = process.env.ENABLE_CACHE !== "false";

class ResponseCache {
  private cache = new Map<string, CacheEntry>();

  public generateKey(request: ChatRequest): string {
    const normalized = {
      model: request.model ?? "",
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.max_tokens ?? 1024,
      stop: request.stop
    };
    return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  }

  public get(key: string): ChatResponse | null {
    if (!IS_CACHE_ENABLED) return null;
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return {
      ...entry.response,
      id: `cache-${Date.now()}`
    };
  }

  public set(key: string, response: ChatResponse, ttlMs = DEFAULT_TTL_MS): void {
    if (!IS_CACHE_ENABLED) return;

    if (this.cache.size >= MAX_CACHE_SIZE) {
      // Evict oldest entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now()
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  public async *streamCachedResponse(response: ChatResponse): AsyncIterable<ChatStreamChunk> {
    const text = response.choices[0].message.content;
    const words = text.split(" ");
    
    for (let i = 0; i < words.length; i++) {
      const isLast = i === words.length - 1;
      const content = words[i] + (isLast ? "" : " ");
      yield {
        id: response.id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        provider: "cache",
        model: response.model,
        choices: [
          {
            index: 0,
            delta: { content },
            finish_reason: isLast ? "stop" : null
          }
        ]
      };
    }
  }
}

export const responseCache = new ResponseCache();
