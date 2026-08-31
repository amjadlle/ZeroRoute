<p align="center">
  <img src="public/logo.png" width="140" alt="ZeroRoute Logo" />
</p>

<h1 align="center">ZeroRoute</h1>
<p align="center"><code>ZERO COST. MAX ROUTE.</code></p>

<p align="center">
  <strong>The $0/mo Multi-Cloud AI Gateway for Solo Founders &amp; Startups.</strong><br />
  <em>Pool 100% free cloud LLM quotas across Groq, SambaNova, Mistral, Google Gemini, NVIDIA NIM, Cloudflare, OpenRouter, and Cohere into one unstoppable, zero-downtime OpenAI-compatible API.</em>
</p>

<p align="center">
  <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/pages">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" />
  </a>
  &nbsp;
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famjadlle%2FZeroRoute&env=GROQ_API_KEY,MISTRAL_API_KEY,GEMINI_API_KEY,SAMBANOVA_API_KEY,OPENROUTER_API_KEY,NVIDIA_API_KEY,ROUTER_API_KEY,ADMIN_KEY&envDescription=Enter%20your%20free-tier%20AI%20provider%20API%20keys%20(add%20at%20least%20one)&envLink=https%3A%2F%2Fgithub.com%2Famjadlle%2FZeroRoute%23-how-to-get-free-api-keys">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
  &nbsp;
  <a href="https://render.com/deploy?repo=https://github.com/amjadlle/ZeroRoute">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/amjadlle/ZeroRoute"><img src="https://img.shields.io/github/stars/amjadlle/ZeroRoute?style=social" alt="GitHub Stars" /></a>
  <img src="https://img.shields.io/badge/License-MIT-red.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Cost-100%25_Free_Tier-green.svg" alt="Free Tier" />
  <img src="https://img.shields.io/badge/OpenAI_API-Drop--in_Compatible-blue.svg" alt="OpenAI Compatible" />
  <img src="https://img.shields.io/badge/Dependencies-Zero_External-purple.svg" alt="Zero Dependencies" />
</p>

---

## 💡 Why ZeroRoute?

As solo founders, indie hackers, and small teams, we want intelligent AI chatbots and APIs in our products — but paying **$20–$200+/month** for commercial LLM APIs before finding product-market fit is prohibitive.

Top cloud AI companies (Groq, SambaNova, Mistral, Google Gemini, OpenRouter, NVIDIA NIM, Cloudflare, Cohere) all offer **generous 100% FREE developer tiers**. The catch? Any single free tier has rate limits (RPM/RPD) or occasional congestion.

**ZeroRoute aggregates all 8 free tiers into one resilient, OpenAI-compatible gateway.**

- If Groq hits a rate limit → fails over to SambaNova in milliseconds.
- If SambaNova is congested → falls back to Mistral, Gemini, OpenRouter, or NVIDIA NIM.
- Identical queries → served from **in-memory SHA-256 cache at 0ms latency**.
- **Result:** Millions of monthly tokens and near 100% uptime for **$0.00/month**.

---

## ⚡ 8 Free-Tier Providers, Out-of-the-Box

| Provider | Default Model | Speed | Strengths |
|---|---|---|---|
| ⚡ **Groq** | openai/gpt-oss-20b | ~100ms | Ultra-fast LPU inference |
| 🔥 **SambaNova** | gemma-4-31B-it | ~360ms | 417+ tokens/sec, SN40L chips |
| 🌪️ **Mistral AI** | mistral-small-latest | ~390ms | European privacy, reasoning |
| 💎 **Google Gemini** | gemini-3.6-flash | ~710ms | 1M+ context, multimodal |
| 🌐 **OpenRouter** | nvidia/nemotron-3.5-lightning:free | ~1500ms | 100% free open-source models |
| 🚀 **NVIDIA NIM** | nvidia/nemotron-3.5-lightning-30b-a3b | ~260ms | DGX enterprise infrastructure |
| ☁️ **Cloudflare** | @cf/meta/llama-3.1-8b-instruct | ~1100ms | 300+ global edge datacenters |
| ⚛️ **Cohere** | command-r-plus-08-2024 | ~1000ms | Enterprise reasoning |

---

## ✨ Key Features

- **🔄 Automatic Failover** — Multi-hop routing on 429, 500, or timeout. Zero manual intervention.
- **💚 Self-Healing Heartbeat** — Probes cooling providers every 30s, auto-restores on recovery.
- **⚡ SSE Streaming** — Real-time `text/event-stream` for chatbots and terminal clients.
- **💾 In-Memory Cache** — SHA-256 keyed response cache serves repeated queries instantly.
- **🛡️ AES-256-GCM Encrypted Keys** — Provider keys encrypted at rest, never exposed to clients.
- **🎛️ Admin Dashboard** — Live playground, benchmark suite, request waterfall, key manager.
- **🌐 Wildcard CORS** — `CORS_ORIGIN=*.yourdomain.com` — allow all your subdomains in one line.
- **📦 Zero Runtime Dependencies** — Pure Node.js `http` and `fetch`. No `node_modules` at runtime.

---

## 🚀 Deployment Options

### 1. Cloudflare Pages (100% Free Edge Hosting — Zero Card Needed)

1. Fork or push this repository to your GitHub account.
2. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select your repository:
   - **Framework preset:** `None`
   - **Build output directory:** `public`
4. Under **Environment variables**, add:
   - `GROQ_API_KEY`, `GEMINI_API_KEY`, or other provider keys
   - `ROUTER_API_KEY` (for chat auth)
   - `ADMIN_KEY` (for dashboard auth)
5. Click **Save and Deploy**. Your full-stack AI Gateway & Dashboard is live globally on `https://your-project.pages.dev`!

---

### 2. 1-Click Vercel Deployment

1. Click **Deploy with Vercel** above (or import the repo in Vercel).
2. Paste at least one free API key (e.g. `GROQ_API_KEY`).
3. Set `ROUTER_API_KEY` (for chat auth) and `ADMIN_KEY` (for dashboard — **use a different value**).
4. Your gateway is live globally on `https://your-project.vercel.app`.

> **Security tip:** `ROUTER_API_KEY` and `ADMIN_KEY` should be different values. The router key is semi-public (used in widgets); the admin key protects your dashboard and should never be shared.

---

### 3. 1-Click Render Deployment

1. Click **Deploy to Render** above (or connect your GitHub repo on [render.com](https://render.com)).
2. Render automatically detects [`render.yaml`](./render.yaml) and configures the web service on the free tier.
3. Fill in your environment variables and click **Apply**.



---

## 💻 Local Quickstart

```bash
git clone https://github.com/amjadlle/ZeroRoute.git
cd ZeroRoute
cp .env.example .env   # add your API keys
npm install
npm run dev            # http://localhost:8787
```

Dashboard: `http://localhost:8787/app`

---

## 🐳 Docker

```bash
docker compose up -d
```

Or build manually:

```bash
docker build -t zeroroute .
docker run -p 8787:8787 --env-file .env zeroroute
```

---

## 🔌 Integration Guide

### 1. Embeddable Chatbot Widget

Drop one `<script>` tag into any website (HTML, Next.js, React, Vue, WordPress, Webflow):

```html
<script
  src="https://your-zeroroute.vercel.app/widget.js"
  data-title="My AI Assistant"
  data-persona="You are a helpful support agent for Acme Corp."
  data-greeting="Hi! How can I help you today? 👋"
  data-color="#6366f1"
  data-key="your-router-api-key"
  defer>
</script>
```

#### Widget Attributes

| Attribute | Description | Example |
|---|---|---|
| `data-title` | Chatbot window title | `Acme Support` |
| `data-greeting` | First message sent to visitors | `Hi! How can I help?` |
| `data-prompts` | 1-Tap quick starter question chips | `Is it free?,How does it work?,Pricing?` |
| `data-logo` | Custom avatar icon / logo image URL | `https://yoursite.com/logo.png` |
| `data-persona` | Inline system prompt | `You are a helpful assistant.` |
| `data-persona-url` | URL to a `.txt` / `.md` system prompt | `https://site.com/prompt.md` |
| `data-knowledge` | Inline FAQs or business facts | `Hours: 9am–6pm. Email: help@acme.com` |
| `data-knowledge-url` | URL to a live `.md` / `.txt` / `.json` file | `https://site.com/knowledge.md` |
| `data-color` | Primary brand color (applies to bubbles, button, focus) | `#3b82f6` |
| `data-key` | Your `ROUTER_API_KEY` (if auth enabled) | `your-secret-key` |

> **Note on `data-key`:** If `ROUTER_API_KEY` is not set in your `.env`, the widget works without a key (public mode). If it is set, pass it via `data-key`.

---

## 🗄️ Multi-Cloud Storage & Persistence

ZeroRoute features a pluggable, multi-engine persistence layer that automatically adapts to your hosting environment:

| Platform | Storage Engine | Setup Required | Cost |
|---|---|---|---|
| **Docker / VPS / Local Node** | **Local Disk (`data/metrics.json`)** | **Zero Config (Automatic)** | **$0/mo** |
| **Cloudflare Pages / Workers** | **Cloudflare KV (`METRICS_KV`)** | **1-Click KV Binding** | **$0/mo (100k reads/day)** |
| **Vercel / Multi-Region** | **Upstash Redis REST** | `UPSTASH_REDIS_REST_URL` in env | **$0/mo (10k req/day)** |

### Setting up Cloudflare KV (for permanent Cloudflare analytics):
1. In Cloudflare Dashboard → **Workers & Pages** → **KV** → Click **Create Namespace** (name: `zeroroute-kv`).
2. In your Pages project → **Settings** → **Functions** → **KV namespace bindings**:
   - Variable name: `METRICS_KV`
   - KV namespace: `zeroroute-kv`

### Setting up Upstash Redis (for Vercel / Multi-Cloud):
Add these environment variables in Vercel or your `.env`:
```env
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

---

### 2. JavaScript / Fetch

```javascript
const response = await fetch("https://your-zeroroute.vercel.app/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-router-api-key"
  },
  body: JSON.stringify({
    stream: true,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" }
    ]
  })
});
```

### 3. Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-zeroroute.vercel.app/v1",
    api_key="your-router-api-key"
)

response = client.chat.completions.create(
    model="default",
    messages=[{"role": "user", "content": "Explain quantum computing briefly."}]
)
print(response.choices[0].message.content)
```

### 4. cURL

```bash
curl -N https://your-zeroroute.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer your-router-api-key" \
  -H "Content-Type: application/json" \
  -d '{"stream":true,"messages":[{"role":"user","content":"Hello!"}]}'
```

---

## 🔑 How to Get Free API Keys

| Provider | URL |
|---|---|
| Groq | [console.groq.com/keys](https://console.groq.com/keys) |
| SambaNova | [cloud.sambanova.ai](https://cloud.sambanova.ai) |
| Mistral AI | [console.mistral.ai](https://console.mistral.ai) |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| NVIDIA NIM | [build.nvidia.com](https://build.nvidia.com) |
| Cloudflare AI | [dash.cloudflare.com](https://dash.cloudflare.com) |
| Cohere | [dashboard.cohere.com](https://dashboard.cohere.com) |

---

## 🛡️ Security

### Two separate keys

| Key | Protects | Who uses it |
|---|---|---|
| `ROUTER_API_KEY` | `/v1/chat/completions`, `/v1/models` | Your widget, apps, API clients |
| `ADMIN_KEY` | `/api/*`, dashboard | Only you — never share this |

**Always set these to different values in production.**

### CORS — restrict which domains can call your gateway

```env
# Allow any origin (default — good for open/public deployments)
CORS_ORIGIN=*

# Lock to your domain and all subdomains
CORS_ORIGIN=*.yourdomain.com

# Multiple specific domains
CORS_ORIGIN=https://app.yourdomain.com,https://yourdomain.com
```

### Other protections

- Provider API keys encrypted at rest with **AES-256-GCM + PBKDF2** (`secrets.json` + `.master.key`).
- Keys masked as `first4••••last4` in all API responses — full secrets never sent to clients.
- Rate limiting: **60 req/min** per IP on chat, **10 req/min** per IP on provider test.
- `.env`, `secrets.json`, `.master.key`, `data/` are in `.gitignore` by default.

---

## 🗂️ Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for a full codebase map, concept explanations, and how to add a new provider.

```
src/
  server.ts          Entry point — ~90 lines, pure dispatcher
  middleware/        Auth & sliding-window rate limiter
  providers/         AI provider implementations, state, and types
  routes/            Route handlers (chat, providers, keys, metrics, static, health)
  services/          Encryption, response cache, metrics logger, and config store
  utils/             Shared HTTP utilities & dynamic CORS
public/
  index.html         Landing page
  dashboard.html     Admin UI
  widget.js          Embeddable chatbot
```

---

## 👨‍💻 Author

**Amjad P A** — Full-Stack AI Engineer & Solo Builder

- 🌐 **Portfolio**: [amjad.mapki.in](https://amjad.mapki.in)
- 🐙 **GitHub**: [@amjadlle](https://github.com/amjadlle)
- 💼 **LinkedIn**: [linkedin.com/in/amjadlle](https://linkedin.com/in/amjadlle)
- 𝕏 **X (Twitter)**: [@amjadlle](https://x.com/amjadlle)
- 📺 **YouTube**: [@reputedculprit](https://youtube.com/@reputedculprit)
- 📸 **Instagram**: [@amjadlle](https://instagram.com/amjadlle)
- 🧵 **Threads**: [@amjadlle](https://www.threads.net/@amjadlle)
- 🤖 **Reddit**: [u/reputed_culprit](https://www.reddit.com/user/reputed_culprit/)
- ✉️ **Email**: [hire.amjad@gmail.com](mailto:hire.amjad@gmail.com)

---

## 📄 License

MIT License © 2026 Amjad P A. Free for personal, commercial, and open-source use.
