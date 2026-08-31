# ZeroRoute — Architecture Guide

A quick map of the codebase for contributors. Read this once and you'll know where everything lives.

---

## How it works in 30 seconds

```
Client request
     │
     ▼
src/server.ts          ← dispatcher only (~90 lines)
     │
     ├─ Static assets  → src/routes/static.ts   (HTML/JS from public/)
     ├─ /health        → src/routes/health.ts
     ├─ /v1/*          → src/routes/chat.ts      ← THE core: failover engine
     ├─ /api/providers → src/routes/providers.ts
     ├─ /api/keys      → src/routes/keys.ts
     └─ /api/metrics   → src/routes/metrics.ts
```

All auth & rate-limiting is in **`src/middleware/auth.ts`**.
Shared HTTP utilities (CORS headers, `sendJson`, `parseBody`) are in **`src/utils/http.ts`**.
Runtime provider state (enabled/cooldown/failover state) lives in **`src/providers/state.ts`**.

---

## Source file map

```
src/
  server.ts              Entry point. Wires routes, starts HTTP server.
  middleware/
    auth.ts              isAuthorized(), isRateLimited(), getClientIp()
  providers/
    providers.ts         All 8 AI provider implementations.
    state.ts             Runtime provider state map + routing helpers.
    types.ts             TypeScript interfaces (ChatRequest, ChatResponse, ...).
  routes/
    chat.ts              POST /v1/chat/completions + GET /v1/models
    health.ts            GET /health
    keys.ts              GET/POST/DELETE /api/keys
    metrics.ts           GET /api/metrics + DELETE /api/metrics/logs + POST /api/cache/clear
    providers.ts         GET/PUT /api/providers + POST /api/providers/:id/test
    static.ts            public/ file serving (landing, dashboard, widget)
  services/
    cache.ts             In-memory response cache (SHA-256 keyed).
    config.ts            Provider enable/order persistence (config.json).
    crypto.ts            Key derivation & AES helpers.
    metrics.ts           In-memory request log & stats counter.
    secrets.ts           Encrypted API key storage (AES-256-GCM).
  utils/
    http.ts              Shared: sendJson, parseBody, CORS headers.

functions/
  [[path]].ts            Cloudflare Pages Functions adapter (Edge runtime)

api/
  index.ts               Vercel Serverless Function adapter

public/
  dashboard.html         Admin dashboard UI (fully client-side JS)
  index.html             Landing / marketing page
  knowledge.md           Default widget knowledge base (editable)
  logo.png               Brand asset
  persona.md             Default widget system prompt (editable)
  widget.js              Embeddable chatbot script (drop-in <script> tag)

scripts/
  discover-models.js     Dev tool: lists available models per provider
  test-providers.js      Dev tool: quick connectivity test for all providers
```

---

## Key concepts

### Automatic failover
`routes/chat.ts` iterates `getEligibleProviders()` in order. If a provider throws,
it is put in cooldown (`COOLDOWN_MS`, default 60 s) and the next one is tried.
A background heartbeat (`server.ts: startSelfHealingHeartbeat`) probes cooling
providers every 30 s and auto-recovers them.

### Encrypted secrets
API keys are never stored in plaintext. `src/secrets.ts` encrypts each key with
AES-256-GCM using a master key (`MASTER_KEY` env var or `.master.key` file).
The encrypted store is written to `secrets.json`.

### Response cache
`src/cache.ts` is an in-memory cache keyed by a SHA-256 hash of the request body.
Identical prompts hit the cache instead of calling upstream APIs.
Cache is flushed on restart; use `POST /api/cache/clear` to flush manually.

### Auth model

| Route group       | Key required     | Env var           |
|-------------------|------------------|-------------------|
| `/v1/*`           | `ROUTER_API_KEY` | Chat auth         |
| `/api/*`          | `ADMIN_KEY`      | Admin operations  |
| `/health`, static | None             | Always public     |

If a key env var is not set, that group is open (public mode). Set both keys for production.

---

## How to add a new provider

1. **Open `src/providers.ts`** and add a new object to the `providers` array.
2. Implement the `Provider` interface:
   ```ts
   {
     id:    "myprovider",
     name:  "My Provider",
     model: "my-model-name",
     generate(body, signal):       Promise<ChatResponse>,
     generateStream(body, signal): Promise<AsyncIterable<ChatStreamChunk>>
   }
   ```
3. Add the provider's API key env var to `.env.example`.
4. Add a case in `src/secrets.ts -> isProviderConfigured()` to check for the key.
5. That's it. Failover, caching, metrics, and the dashboard all pick it up automatically.

---

## API routes reference

| Method   | Path                      | Auth       | Description                        |
|----------|---------------------------|------------|------------------------------------|
| `POST`   | `/v1/chat/completions`    | Router key | OpenAI-compatible chat             |
| `GET`    | `/v1/models`              | Router key | List available models              |
| `GET`    | `/health`                 | None       | Uptime + aggregate counters        |
| `GET`    | `/api/providers`          | Admin key  | List provider state                |
| `PUT`    | `/api/providers`          | Admin key  | Update provider order/model/on-off |
| `POST`   | `/api/providers/:id/test` | Admin key  | Ping a specific provider           |
| `GET`    | `/api/keys`               | Admin key  | List key configuration status      |
| `POST`   | `/api/keys`               | Admin key  | Save an encrypted API key          |
| `DELETE` | `/api/keys/:id`           | Admin key  | Remove an API key                  |
| `GET`    | `/api/metrics`            | Admin key  | Request logs + stats + cache size  |
| `DELETE` | `/api/metrics/logs`       | Admin key  | Clear request logs                 |
| `POST`   | `/api/cache/clear`        | Admin key  | Flush response cache               |

---

## Running locally

```bash
cp .env.example .env        # add your API keys
npm install
npm run dev                 # starts on http://localhost:8787
```

Dashboard: `http://localhost:8787/app`

## Building for production

```bash
npm run build               # tsc -> dist/
node dist/server.js
```

Or with Docker:

```bash
docker build -t zeroroute .
docker run -p 8787:8787 --env-file .env zeroroute
```
