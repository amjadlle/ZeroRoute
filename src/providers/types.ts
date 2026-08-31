export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
};

export type UsageMetrics = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type ChatResponse = {
  id: string;
  object: "chat.completion";
  created?: number;
  provider: string;
  model: string;
  choices: [
    {
      index: 0;
      message: { role: "assistant"; content: string };
      finish_reason: "stop" | "length" | string;
    }
  ];
  usage?: UsageMetrics;
};

export type ChatStreamChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  provider: string;
  model: string;
  choices: [
    {
      index: 0;
      delta: { role?: "assistant"; content?: string };
      finish_reason: "stop" | "length" | null | string;
    }
  ];
};

export type Provider = {
  id: string;
  name: string;
  model: string;
  generate: (request: ChatRequest, signal?: AbortSignal) => Promise<ChatResponse>;
  generateStream: (request: ChatRequest, signal?: AbortSignal) => AsyncIterable<ChatStreamChunk> | Promise<AsyncIterable<ChatStreamChunk>>;
};

export type ProviderRuntimeState = {
  id: string;
  name: string;
  model: string;
  enabled: boolean;
  order: number;
  configured: boolean;
  consecutiveFailures: number;
  cooldownUntil: number;
  lastLatencyMs?: number;
  lastError?: string;
};
