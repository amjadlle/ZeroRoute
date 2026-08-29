export type RequestLogEntry = {
  id: string;
  timestamp: number;
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

export type GatewayStats = {
  totalRequests: number;
  cacheHits: number;
  totalTokens: number;
  savedTokens: number;
  estimatedSavingsUsd: string;
  avgLatencyMs: number;
  successfulRequests: number;
  failedRequests: number;
};

const MAX_LOGS = 100;

class MetricsLogger {
  private logs: RequestLogEntry[] = [];
  private totalRequests = 0;
  private cacheHits = 0;
  private totalTokens = 0;
  private savedTokens = 0;
  private totalLatencySum = 0;
  private successfulRequests = 0;
  private failedRequests = 0;

  public log(entry: RequestLogEntry): void {
    this.totalRequests++;
    if (entry.isCacheHit) {
      this.cacheHits++;
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
    }

    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop();
    }
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
      failedRequests: this.failedRequests
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
  }
}

export const metricsLogger = new MetricsLogger();
