# Changelog

All notable changes to **ZeroRoute** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
