<p align="center">
  <img src="public/logo.png" width="140" alt="ZeroRoute Logo" />
</p>

<h1 align="center">ZeroRoute</h1>
<p align="center"><code>ZERO COST. MAX ROUTE.</code></p>

<p align="center">
  <strong>The $0/mo Multi-Cloud AI Gateway for Solo Founders & Startups.</strong><br />
  <em>Pool 100% free cloud LLM quotas across Groq, SambaNova, Mistral, Google Gemini, NVIDIA NIM, Cloudflare, and Cohere into one unstoppable, zero-downtime OpenAI-compatible API.</em>
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Famjadlle%2FZeroRoute&env=GROQ_API_KEY,MISTRAL_API_KEY,GEMINI_API_KEY,SAMBANOVA_API_KEY,OPENROUTER_API_KEY,NVIDIA_API_KEY,ROUTER_API_KEY&envDescription=Enter%20your%20free-tier%20AI%20provider%20API%20keys%20(add%20at%20least%20one)&envLink=https%3A%2F%2Fgithub.com%2Famjadlle%2FZeroRoute%23how-to-get-free-api-keys">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
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

## 💡 The Founder's Story: Why ZeroRoute?

As solo founders, indie hackers, and small business owners, we want to add intelligent AI chatbots, customer support assistants, and content generators to our websites and portfolio apps. 

However, paying **\ to \+/month** for commercial LLM APIs before finding product-market fit can be prohibitive. 

Meanwhile, top cloud AI infrastructure companies (Groq, SambaNova, Mistral, Google Gemini, OpenRouter, NVIDIA NIM, Cloudflare, Cohere) offer **generous 100% FREE developer tiers**. The catch? Any single free tier has rate limits (RPM / RPD) or occasional congestion.

### 🎯 The Solution:
**ZeroRoute aggregates all 8 free cloud tiers into one unified, resilient, high-speed OpenAI-compatible gateway.** 
- If Groq is busy, it automatically fails over to SambaNova in milliseconds.
- If SambaNova hits a rate limit, it falls back to Mistral, Gemini, OpenRouter, or NVIDIA NIM.
- Exact queries are served from **in-memory RAM cache at 0ms latency for .00**.
- **Result:** You get **millions of monthly tokens and near 100% uptime for \.00/month!**

---

## ⚡ 8 Free-Tier Cloud Providers Supported Out-Of-The-Box

| Provider | Default Verified Model | Speed / Latency | Key Strengths |
|---|---|---|---|
| ⚡ **Groq** | qwen/qwen3.6-27b / openai/gpt-oss-120b | **~100ms** | Ultra-fast LPU inference, instant streaming |
| 🔥 **SambaNova** | MiniMax-M2.7 / gemma-4-31B-it | **~360ms** | 417+ tokens/sec throughput, SN40L chips |
| 🌪️ **Mistral AI** | mistral-medium-latest / codestral-latest | **~390ms** | European privacy, specialized coding & reasoning |
| 💎 **Google Gemini** | gemini-3.5-flash-lite / gemini-flash-lite-latest | **~710ms** | 1M+ token context window, Google multimodal |
| 🌐 **OpenRouter** | 
vidia/nemotron-3.5-lightning:free | **~1500ms** | 100% free open-source models aggregator |
| 🚀 **NVIDIA NIM** | 
vidia/nemotron-3.5-lightning-30b-a3b | **~260ms** | Accelerated enterprise DGX cloud infrastructure |
| ☁️ **Cloudflare Workers AI** | @cf/meta/llama-3.1-8b-instruct | **~1100ms** | Global edge network with 300+ datacenters |
| ⚛️ **Cohere** | command-r-plus-08-2024 | **~1000ms** | Enterprise conversational reasoning |

---

## ✨ Key Features

- **🔄 Zero-Downtime Provider Failover**: Automatic multi-hop routing if any upstream provider encounters a 429, 500, or Timeout.
- **⚡ Parallel Concurrency Benchmark Suite**: Races all 8 providers in parallel (~1.5s total) with an animated progress bar, winner podium, and **1-Click Optimal Order Sorting**.
- **🔄 Self-Healing Background Heartbeat**: Automatically probes cooling providers every 30s and restores them to active traffic the instant their rate limit clears.
- **⚡ Real-Time SSE Streaming (	ext/event-stream)**: Smooth token-by-token streaming for web chatbots and terminal clients.
- **💾 In-Memory SHA-256 Response Cache**: Serves identical requests instantly at **0ms latency** with live dollar savings estimation.
- **🛡️ AES-256-GCM Encrypted Key Storage**: API keys are encrypted at rest on disk with PBKDF2 key derivation and never exposed over client network payloads.
- **🎛️ Obsidian & Crimson Brand Dashboard**: Interactive model catalog modal, raw error inspector, request waterfall trace, and live playground with custom system persona prompts.
- **📦 Zero Runtime NPM Dependencies**: Built purely with native Node.js HTTP and Fetch APIs.

---

## 🚀 1-Click Cloud Deployment (Vercel)

Deploy your own private AI Gateway to Vercel in 30 seconds:

1. Click the **Deploy with Vercel** button above.
2. Paste at least one free API key (e.g. GROQ_API_KEY, MISTRAL_API_KEY, or GEMINI_API_KEY).
3. Your gateway and live dashboard are instantly live globally on https://your-project.vercel.app!

---

## 💻 Local Quickstart

### 1. Clone & Setup
\\\ash
git clone https://github.com/amjadlle/ZeroRoute.git
cd ZeroRoute
cp .env.example .env
npm install
\\\

### 2. Configure Keys
Open .env and add any free API keys you have:
\\\env
# Fast Free Tiers
GROQ_API_KEY=gsk_...
SAMBANOVA_API_KEY=...
MISTRAL_API_KEY=...
GEMINI_API_KEY=AIzaSy...
\\\

### 3. Start the Gateway
\\\ash
npm run dev
\\\
Visit **http://localhost:8787** to open your live dashboard!

---

## 🐳 Docker Deployment

Run with Docker Compose in 1 command:
\\\ash
docker compose up -d
\\\

---

## 🔌 Integration Guide (Drop-In OpenAI Replacement)

### 💬 1. 1-Line Embeddable Website Chatbot Widget
Drop this single line of HTML anywhere in your website (`index.html`, Next.js, React, Vue, WordPress, Webflow, or Shopify) to add an AI floating chatbot bubble powered by your free cloud LLM tiers:

```html
<script 
  src="https://your-zeroroute.vercel.app/widget.js" 
  data-title="Amjad AI" 
  data-persona="You are Amjad's portfolio assistant. Answer questions politely and concisely." 
  data-greeting="Hi there! 👋 How can I help you today?" 
  data-color="#ef4444" 
  defer>
</script>
```

#### 📚 Adding a Business Knowledge Base & Custom Persona (Zero DB Needed!):
You can attach your company FAQs, bio, documentation, or pricing by passing inline text OR a remote `.md` / `.txt` / `.json` file URL:

```html
<script 
  src="https://your-zeroroute.vercel.app/widget.js" 
  data-title="Acme Support AI" 
  data-persona-url="https://your-website.com/persona.txt"
  data-knowledge-url="https://raw.githubusercontent.com/username/repo/main/faq.md"
  data-color="#ef4444"
  defer>
</script>
```

| Attribute | Description | Example |
|---|---|---|
| `data-title` | Header title of the chatbot window | `Amjad AI` |
| `data-persona` | Inline system prompt & tone | `You are a helpful customer support agent.` |
| `data-persona-url` | Remote URL to a system prompt `.txt` / `.md` file | `https://site.com/prompt.md` |
| `data-knowledge` | Inline business facts, FAQs, or pricing text | `Pricing: $0/mo, Support: help@acme.com` |
| `data-knowledge-url` | Remote URL to a live `.md`, `.txt`, or `.json` file | `https://site.com/knowledge.md` |
| `data-greeting` | First message sent to visitors | `Hi! How can I help you?` |
| `data-color` | Primary brand accent color | `#ef4444` or `#6366f1` |
| `data-key` | Your `ROUTER_API_KEY` (if protected) | `amjadisthebest` |

### 2. Web Chatbot / JavaScript (Direct API)
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
      { role: "system", content: "You are a helpful customer support chatbot." },
      { role: "user", content: "Hello! What are your business hours?" }
    ]
  })
});
```

### 3. Python (Official OpenAI SDK)
\\\python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-zeroroute.vercel.app/v1",
    api_key="your-router-api-key"
)

response = client.chat.completions.create(
    model="default",  # Or specify exact provider/model
    messages=[
        {"role": "system", "content": "You are a professional assistant."},
        {"role": "user", "content": "Summarize this article."}
    ]
)

print(response.choices[0].message.content)
\\\

### 4. cURL
```bash
curl -N https://your-zeroroute.vercel.app/v1/chat/completions \
  -H "Authorization: Bearer your-router-api-key" \
  -H "Content-Type: application/json" \
  -d '{"stream":true,"messages":[{"role":"user","content":"Explain quantum computing in one sentence."}]}'
\\\

---

## 🔑 How to Get Free API Keys

- **Groq Console**: [console.groq.com/keys](https://console.groq.com/keys)
- **SambaNova Cloud**: [cloud.sambanova.ai](https://cloud.sambanova.ai)
- **Mistral AI Console**: [console.mistral.ai](https://console.mistral.ai)
- **Google AI Studio**: [aistudio.google.com](https://aistudio.google.com)
- **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys)
- **NVIDIA NIM**: [build.nvidia.com](https://build.nvidia.com)
- **Cloudflare AI**: [dash.cloudflare.com](https://dash.cloudflare.com)
- **Cohere Dashboard**: [dashboard.cohere.com](https://dashboard.cohere.com)

---

## 🛡️ Security & Privacy

- **Encrypted Local Credentials**: Saved keys are encrypted using AES-256-GCM (secrets.json + .master.key).
- **Masked Secrets**: Keys are never transmitted in full to the client (irst4••••••••last4).
- **Git Shield**: All credential files (.env, secrets.json, .master.key) are in .gitignore.

---

## 👨‍💻 Author & Creator

**Amjad P A** — Full-Stack AI Engineer & Solo Builder

- 🌐 **Portfolio**: [amjad.mapki.in](https://amjad.mapki.in)
- 🐙 **GitHub**: [@amjadlle](https://github.com/amjadlle)
- 💼 **LinkedIn**: [in/amjadlle](https://linkedin.com/in/amjadlle)
- ✉️ **Email**: [hire.amjad@gmail.com](mailto:hire.amjad@gmail.com)

---

## 📄 License

MIT License © 2026 Amjad P A. Free for personal, commercial, and open-source use.
