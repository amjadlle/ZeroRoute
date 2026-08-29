/* eslint-disable @typescript-eslint/no-explicit-any -- provider responses are dynamic JSON */
import type { ChatRequest, ChatResponse, ChatStreamChunk, Provider } from "./types.js";
import { getProviderApiKey } from "./secrets.js";

const parseJsonOrError = async (response: Response, name: string) => {
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 500);
    throw new Error(`${name} returned ${response.status}: ${errorText}`);
  }
  return response.json() as Promise<any>;
};

async function* parseSSE(stream: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          const data = trimmed.slice(5).trim();
          if (data && data !== "[DONE]") {
            yield data;
          }
        }
      }
    }
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const data = trimmed.slice(5).trim();
        if (data && data !== "[DONE]") {
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const openAIStyle = (
  id: string,
  url: string,
  key: string | undefined,
  model: string,
  request: ChatRequest,
  signal?: AbortSignal
) => {
  if (!key) throw new Error(`${id} API key is not configured`);
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.max_tokens ?? 1024
    }),
    signal
  });
};

async function* openAIStyleStream(
  id: string,
  url: string,
  key: string | undefined,
  model: string,
  request: ChatRequest,
  signal?: AbortSignal
): AsyncIterable<ChatStreamChunk> {
  if (!key) throw new Error(`${id} API key is not configured`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.max_tokens ?? 1024,
      stream: true
    }),
    signal
  });

  if (!res.ok) {
    const errorText = (await res.text()).slice(0, 500);
    throw new Error(`${id} returned ${res.status}: ${errorText}`);
  }
  if (!res.body) throw new Error(`${id} returned no response stream`);

  for await (const line of parseSSE(res.body)) {
    try {
      const data = JSON.parse(line);
      const content = data.choices?.[0]?.delta?.content ?? "";
      const finish_reason = data.choices?.[0]?.finish_reason ?? null;
      yield {
        id: data.id ?? `${id}-${Date.now()}`,
        object: "chat.completion.chunk",
        created: data.created ?? Math.floor(Date.now() / 1000),
        provider: id,
        model,
        choices: [
          {
            index: 0,
            delta: { content },
            finish_reason
          }
        ]
      };
    } catch {
      // ignore JSON parse errors in malformed chunks
    }
  }
}

const normalize = (id: string, model: string, data: any): ChatResponse => {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`${id} returned no text`);
  }
  return {
    id: data.id ?? `${id}-${Date.now()}`,
    object: "chat.completion",
    created: data.created ?? Math.floor(Date.now() / 1000),
    provider: id,
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: data.choices?.[0]?.finish_reason ?? "stop"
      }
    ],
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens
        }
      : undefined
  };
};

async function* fallbackStreamFromGenerate(
  provider: { generate: (r: ChatRequest, s?: AbortSignal) => Promise<ChatResponse> },
  request: ChatRequest,
  signal?: AbortSignal
): AsyncIterable<ChatStreamChunk> {
  const resp = await provider.generate(request, signal);
  const content = resp.choices[0].message.content;
  yield {
    id: resp.id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    provider: resp.provider,
    model: resp.model,
    choices: [
      {
        index: 0,
        delta: { role: "assistant", content },
        finish_reason: "stop"
      }
    ]
  };
}

export const providers: Provider[] = [
  {
    id: "sambanova",
    name: "SambaNova",
    model: process.env.SAMBANOVA_MODEL ?? "gemma-4-31B-it",
    generate: async function (r, s) {
      const key = getProviderApiKey("sambanova");
      const res = await openAIStyle("sambanova", "https://api.sambanova.ai/v1/chat/completions", key, this.model, r, s);
      return normalize("sambanova", this.model, await parseJsonOrError(res, "sambanova"));
    },
    generateStream: function (r, s) {
      const key = getProviderApiKey("sambanova");
      return openAIStyleStream("sambanova", "https://api.sambanova.ai/v1/chat/completions", key, this.model, r, s);
    }
  },
  {
    id: "groq",
    name: "Groq",
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    generate: async function (r, s) {
      const key = getProviderApiKey("groq");
      const res = await openAIStyle("groq", "https://api.groq.com/openai/v1/chat/completions", key, this.model, r, s);
      return normalize("groq", this.model, await parseJsonOrError(res, "groq"));
    },
    generateStream: function (r, s) {
      const key = getProviderApiKey("groq");
      return openAIStyleStream("groq", "https://api.groq.com/openai/v1/chat/completions", key, this.model, r, s);
    }
  },
  {
    id: "mistral",
    name: "Mistral AI",
    model: process.env.MISTRAL_MODEL ?? "mistral-small-latest",
    generate: async function (r, s) {
      const key = getProviderApiKey("mistral");
      const res = await openAIStyle("mistral", "https://api.mistral.ai/v1/chat/completions", key, this.model, r, s);
      return normalize("mistral", this.model, await parseJsonOrError(res, "mistral"));
    },
    generateStream: function (r, s) {
      const key = getProviderApiKey("mistral");
      return openAIStyleStream("mistral", "https://api.mistral.ai/v1/chat/completions", key, this.model, r, s);
    }
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    model: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3.5-lightning:free",
    generate: async function (r, s) {
      const key = getProviderApiKey("openrouter");
      const res = await openAIStyle("openrouter", "https://openrouter.ai/api/v1/chat/completions", key, this.model, r, s);
      return normalize("openrouter", this.model, await parseJsonOrError(res, "openrouter"));
    },
    generateStream: function (r, s) {
      const key = getProviderApiKey("openrouter");
      return openAIStyleStream("openrouter", "https://openrouter.ai/api/v1/chat/completions", key, this.model, r, s);
    }
  },
  {
    id: "gemini",
    name: "Google Gemini",
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
    generate: async function (r, s) {
      const key = getProviderApiKey("gemini");
      if (!key) throw new Error("gemini API key is not configured");
      const system = r.messages.find(m => m.role === "system")?.content;
      const contents = r.messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: {
            temperature: r.temperature ?? 0.3,
            maxOutputTokens: r.max_tokens ?? 1024
          }
        }),
        signal: s
      });

      const data = await parseJsonOrError(res, "gemini");
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof content !== "string") throw new Error("gemini returned no text");
      return normalize("gemini", this.model, {
        choices: [{ message: { content } }],
        usage: data.usageMetadata
          ? {
              prompt_tokens: data.usageMetadata.promptTokenCount,
              completion_tokens: data.usageMetadata.candidatesTokenCount,
              total_tokens: data.usageMetadata.totalTokenCount
            }
          : undefined
      });
    },
    generateStream: async function* (r, s) {
      const key = getProviderApiKey("gemini");
      if (!key) throw new Error("gemini API key is not configured");
      const system = r.messages.find(m => m.role === "system")?.content;
      const contents = r.messages
        .filter(m => m.role !== "system")
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: {
            temperature: r.temperature ?? 0.3,
            maxOutputTokens: r.max_tokens ?? 1024
          }
        }),
        signal: s
      });

      if (!res.ok) {
        const errorText = (await res.text()).slice(0, 500);
        throw new Error(`gemini returned ${res.status}: ${errorText}`);
      }
      if (!res.body) throw new Error("gemini returned no response stream");

      for await (const line of parseSSE(res.body)) {
        try {
          const data = JSON.parse(line);
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          const finish_reason = data.candidates?.[0]?.finishReason ? "stop" : null;
          yield {
            id: `gemini-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            provider: "gemini",
            model: this.model,
            choices: [
              {
                index: 0,
                delta: { content },
                finish_reason
              }
            ]
          };
        } catch {
          // ignore parsing error
        }
      }
    }
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    model: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-lightning-30b-a3b",
    generate: async function (r, s) {
      const key = getProviderApiKey("nvidia");
      const res = await openAIStyle("nvidia", "https://integrate.api.nvidia.com/v1/chat/completions", key, this.model, r, s);
      return normalize("nvidia", this.model, await parseJsonOrError(res, "nvidia"));
    },
    generateStream: function (r, s) {
      const key = getProviderApiKey("nvidia");
      return openAIStyleStream("nvidia", "https://integrate.api.nvidia.com/v1/chat/completions", key, this.model, r, s);
    }
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    model: process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct",
    generate: async function (r, s) {
      const key = getProviderApiKey("cloudflare") || process.env.CLOUDFLARE_API_TOKEN;
      const account = process.env.CLOUDFLARE_ACCOUNT_ID;
      if (!key || !account) throw new Error("cloudflare credentials are not configured");
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${this.model}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ messages: r.messages }),
        signal: s
      });
      const data = await parseJsonOrError(res, "cloudflare");
      return normalize("cloudflare", this.model, {
        choices: [{ message: { content: data.result?.response } }]
      });
    },
    generateStream: function (r, s) {
      return fallbackStreamFromGenerate(this, r, s);
    }
  },
  {
    id: "cohere",
    name: "Cohere",
    model: process.env.COHERE_MODEL ?? "command-r-plus-08-2024",
    generate: async function (r, s) {
      const key = getProviderApiKey("cohere");
      if (!key) throw new Error("cohere API key is not configured");
      const system = r.messages.find(m => m.role === "system")?.content;
      const history = r.messages
        .filter(m => m.role !== "system")
        .slice(0, -1)
        .map(m => ({ role: m.role === "assistant" ? "CHATBOT" : "USER", message: m.content }));
      const last = r.messages[r.messages.length - 1];

      const res = await fetch("https://api.cohere.com/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: this.model,
          message: last.content,
          chat_history: history,
          preamble: system,
          temperature: r.temperature ?? 0.3
        }),
        signal: s
      });
      const data = await parseJsonOrError(res, "cohere");
      return normalize("cohere", this.model, {
        choices: [{ message: { content: data.text } }],
        usage: data.meta?.tokens
          ? {
              prompt_tokens: data.meta.tokens.input_tokens,
              completion_tokens: data.meta.tokens.output_tokens,
              total_tokens: (data.meta.tokens.input_tokens || 0) + (data.meta.tokens.output_tokens || 0)
            }
          : undefined
      });
    },
    generateStream: function (r, s) {
      return fallbackStreamFromGenerate(this, r, s);
    }
  }
];
