# Changelog

All notable changes to **ZeroRoute** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.2] - 2026-09-01

### Buy Me a Coffee Integration & Sponsor Support ☕

#### Added
- **Buy Me a Coffee Integration**: Embedded supporter CTAs across the top navigation header and footer.
- **GitHub Sponsor Configuration**: Added `.github/FUNDING.yml` linking to `@amjadlle` for 1-click open-source repository sponsorship.
- **README Badges & Support Section**: Added Buy Me a Coffee badge and dedicated project support section.

---

## [0.1.1] - 2026-08-31

### Multi-Tenant Analytics, Cloud Persistence & Widget Upgrades 📊

#### Added
- **Multi-Tenant Website Traffic Analytics**: Dedicated dashboard tab with real-time breakdown of requests, token volume, cache savings %, and last ping timestamp per website origin domain (`teledrive.mapki.in`, `busnap.mapki.in`, etc.).
- **Live Provider Quota & Health Monitor**: Real-time quota tracking alerting on HTTP 429 rate limit events, consecutive failures, and failover cooldown states across all 8 cloud providers.
- **Universal Multi-Engine Persistence Layer**:
  - **Local Disk (`data/metrics.json`)**: Automatic zero-config auto-save/auto-load on Docker, VPS, and Node.js servers.
  - **Cloudflare KV (`env.METRICS_KV`)**: Native persistent cloud state across global serverless isolates on Cloudflare Pages.
  - **Upstash Redis REST (`UPSTASH_REDIS_REST_URL`)**: 1-click cloud state sync for Vercel and multi-region serverless clusters.
- **Website Origin Log Filter**: Interactive dropdown in the *Logs & Failovers* table allowing admins to isolate and inspect traffic for specific client websites.
- **Embeddable Chatbot Upgrades (`public/widget.js`)**:
  - `data-prompts`: Clickable 1-tap quick starter question chips below initial greeting.
  - `data-logo`: Custom bot avatar image URL with clean SVG robot fallback.
  - **Animated Typing Waves**: Smooth bouncing dot indicator while AI tokens stream.
  - **Neutral Universal Drop Shadows**: Natural dark shadows replacing hardcoded glows for seamless integration on third-party site themes.

---

## [0.1.0] - 2026-08-31

### Initial Open-Source Release 🚀

#### Added
- **Multi-Cloud AI Gateway**: Zero-downtime routing across 8 free AI providers (Groq, SambaNova, Mistral AI, OpenRouter, Google Gemini, NVIDIA NIM, Cloudflare Workers AI, and Cohere).
- **Circuit Breaker & Auto-Failover**: Sub-8ms failover with exponential backoff and automatic provider cooldown on HTTP 429 / 5xx errors.
- **In-Memory Semantic & Exact RAM Caching**: Zero-cost exact prompt caching with TTL expiration.
- **1-Line Embeddable Chatbot Widget (`widget.js`)**: Pure vanilla JS widget supporting custom knowledge base RAG (`.md`, `.txt`, `.json`), Markdown rendering, and dynamic themes with zero external dependencies.
- **Admin Management Console (`/app`)**: Real-time provider drag-and-drop reordering, interactive playground with streaming, latency benchmarking suite, encrypted credential vault (AES-256), and live request logs.
- **Multi-Platform Deployment**: 1-click Edge deployment for Cloudflare Pages (`functions/[[path]].ts`), Vercel (`api/index.ts`), Render (`render.yaml`), Docker Compose, and self-hosted Node.js.
- **Subdomain Wildcard CORS**: Dynamic origin reflection supporting `*.domain.com` wildcards.
- **Security & Privacy**: Strict separation of `ADMIN_KEY` (management) and `ROUTER_API_KEY` (chat clients), rate limiting via sliding-window counter, and sanitization of sensitive credentials.
