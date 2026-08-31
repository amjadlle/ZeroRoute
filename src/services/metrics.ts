import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export type RequestLogEntry = {
  id: string;
  timestamp: number;
  origin?: string;
  promptPreview: string;
  responsePreview?: string;
  provider: string;
  model: string;
  latencyMs: number;
  status: number;
  isStream: boolean;
  isCacheHit: boolean;
  failovers: string[];
  tokens?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type OriginStat = {
  requests: number;
  cacheHits: number;
  totalTokens: number;
  lastActive: number;
};

export type ProviderStat = {
  requests: number;
  errors: number;
  rateLimits: number;
  lastUsed: number;
};

export type GatewayStats = {
  totalRequests: number;
  cacheHits: number;
  totalTokens: number;
  savedTokens: number;
  estimatedSavingsUsd: string;
  avgLatencyMs: number;
  successfulRequests: number;
  failedRequests: number;
  origins: Record<string, OriginStat>;
  providers: Record<string, ProviderStat>;
  models: Record<string, number>;
};

export type PersistedMetricsState = {
  logs: RequestLogEntry[];
  totalRequests: number;
  cacheHits: number;
  totalTokens: number;
  savedTokens: number;
  totalLatencySum: number;
  successfulRequests: number;
  failedRequests: number;
  originStats: Record<string, OriginStat>;
  providerStats: Record<string, ProviderStat>;
  modelStats: Record<string, number>;
};

const MAX_LOGS = 100;
const METRICS_FILE = resolve(process.cwd(), "data", "metrics.json");

class MetricsLogger {
  private logs: RequestLogEntry[] = [];
  private totalRequests = 0;
  private cacheHits = 0;
  private totalTokens = 0;
  private savedTokens = 0;
  private totalLatencySum = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private originStats: Record<string, OriginStat> = {};
  private providerStats: Record<string, ProviderStat> = {};
  private modelStats: Record<string, number> = {};
  private saveTimer: any = null;

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    // 1. Check Upstash Redis REST / Vercel KV if configured
    const upstashUrl = process.env?.UPSTASH_REDIS_REST_URL || process.env?.KV_REST_API_URL;
    const upstashToken = process.env?.UPSTASH_REDIS_REST_TOKEN || process.env?.KV_REST_API_TOKEN;
    if (upstashUrl && upstashToken && typeof fetch === "function") {
      fetch(`${upstashUrl}/get/zeroroute_metrics_state`, {
        headers: { Authorization: `Bearer ${upstashToken}` }
      })
        .then(r => r.json())
        .then((res: any) => {
          if (res?.result) {
            const parsed = typeof res.result === "string" ? JSON.parse(res.result) : res.result;
            if (parsed) this.importState(parsed);
          }
        })
        .catch(() => {});
    }

    // 2. Check local disk file
    try {
      if (typeof process === "undefined" || !existsSync || !readFileSync) return;
      if (!existsSync(METRICS_FILE)) return;
      const raw = readFileSync(METRICS_FILE, "utf-8");
      const data = JSON.parse(raw) as PersistedMetricsState;
      if (data) {
        this.importState(data);
      }
    } catch {
      // Graceful fallback for read-only / serverless environments
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveToDisk();
    }, 1000);
  }

  private saveToDisk(): void {
    const data = this.exportState();

    // 1. Sync to Upstash Redis REST / Vercel KV if configured
    const upstashUrl = process.env?.UPSTASH_REDIS_REST_URL || process.env?.KV_REST_API_URL;
    const upstashToken = process.env?.UPSTASH_REDIS_REST_TOKEN || process.env?.KV_REST_API_TOKEN;
    if (upstashUrl && upstashToken && typeof fetch === "function") {
      fetch(`${upstashUrl}/set/zeroroute_metrics_state`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(JSON.stringify(data))
      }).catch(() => {});
    }

    // 2. Save to local disk
    try {
      if (typeof process === "undefined" || !writeFileSync || !mkdirSync) return;
      const dir = dirname(METRICS_FILE);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Graceful fallback for read-only / serverless environments
    }
  }

  public exportState(): PersistedMetricsState {
    return {
      logs: this.logs,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      totalTokens: this.totalTokens,
      savedTokens: this.savedTokens,
      totalLatencySum: this.totalLatencySum,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      originStats: this.originStats,
      providerStats: this.providerStats,
      modelStats: this.modelStats
    };
  }

  public importState(data: Partial<PersistedMetricsState>): void {
    if (Array.isArray(data.logs)) this.logs = data.logs.slice(0, MAX_LOGS);
    if (typeof data.totalRequests === "number") this.totalRequests = data.totalRequests;
    if (typeof data.cacheHits === "number") this.cacheHits = data.cacheHits;
    if (typeof data.totalTokens === "number") this.totalTokens = data.totalTokens;
    if (typeof data.savedTokens === "number") this.savedTokens = data.savedTokens;
    if (typeof data.totalLatencySum === "number") this.totalLatencySum = data.totalLatencySum;
    if (typeof data.successfulRequests === "number") this.successfulRequests = data.successfulRequests;
    if (typeof data.failedRequests === "number") this.failedRequests = data.failedRequests;
    if (data.originStats && typeof data.originStats === "object") this.originStats = { ...data.originStats };
    if (data.providerStats && typeof data.providerStats === "object") this.providerStats = { ...data.providerStats };
    if (data.modelStats && typeof data.modelStats === "object") this.modelStats = { ...data.modelStats };
  }

  public log(entry: RequestLogEntry): void {
    this.totalRequests++;
    const originKey = entry.origin ? entry.origin.replace(/^https?:\/\//, '').split('/')[0] : 'Direct API';
    
    if (!this.originStats[originKey]) {
      this.originStats[originKey] = { requests: 0, cacheHits: 0, totalTokens: 0, lastActive: entry.timestamp };
    }
    this.originStats[originKey].requests++;
    this.originStats[originKey].lastActive = entry.timestamp;

    const baseProvider = entry.provider.replace(/^cache \((.*)\)$/, '$1');
    if (!this.providerStats[baseProvider]) {
      this.providerStats[baseProvider] = { requests: 0, errors: 0, rateLimits: 0, lastUsed: entry.timestamp };
    }
    this.providerStats[baseProvider].requests++;
    this.providerStats[baseProvider].lastUsed = entry.timestamp;

    if (entry.status === 429) {
      this.providerStats[baseProvider].rateLimits++;
    } else if (entry.status >= 400) {
      this.providerStats[baseProvider].errors++;
    }

    if (entry.model) {
      this.modelStats[entry.model] = (this.modelStats[entry.model] || 0) + 1;
    }

    if (entry.isCacheHit) {
      this.cacheHits++;
      this.originStats[originKey].cacheHits++;
      const cachedTok = entry.tokens?.total_tokens || 280;
      this.savedTokens += cachedTok;
    }
    if (entry.status >= 200 && entry.status < 300) {
      this.successfulRequests++;
      this.totalLatencySum += entry.latencyMs;
    } else {
      this.failedRequests++;
    }

    if (entry.tokens?.total_tokens) {
      this.totalTokens += entry.tokens.total_tokens;
      this.originStats[originKey].totalTokens += entry.tokens.total_tokens;
    }

    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop();
    }

    this.scheduleSave();
  }

  public getLogs(): RequestLogEntry[] {
    return this.logs;
  }

  public getStats(): GatewayStats {
    const avgLatencyMs = this.successfulRequests > 0 ? Math.round(this.totalLatencySum / this.successfulRequests) : 0;
    const savings = (this.savedTokens * 0.0000025).toFixed(4);
    return {
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits,
      totalTokens: this.totalTokens,
      savedTokens: this.savedTokens,
      estimatedSavingsUsd: `$${savings}`,
      avgLatencyMs,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      origins: this.originStats,
      providers: this.providerStats,
      models: this.modelStats
    };
  }

  public clear(): void {
    this.logs = [];
    this.totalRequests = 0;
    this.cacheHits = 0;
    this.totalTokens = 0;
    this.savedTokens = 0;
    this.totalLatencySum = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.originStats = {};
    this.providerStats = {};
    this.modelStats = {};
    this.saveToDisk();
  }
}

export const metricsLogger = new MetricsLogger();
