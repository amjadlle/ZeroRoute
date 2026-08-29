# ZeroRoute Knowledge Base

## Product Overview
ZeroRoute is a 100% free, open-source multi-cloud AI Gateway and 1-line embeddable website chatbot created for solo founders, developers, and startups. It pools free-tier API quotas across 8 cloud providers into one zero-downtime OpenAI-compatible endpoint.

## Supported Free Cloud Providers & Models
1. **Groq**: Fastest inference (~100ms), models: openai/gpt-oss-20b, llama-3.3-70b-versatile.
2. **NVIDIA NIM**: Ultra-fast (~260ms), model: meta/llama-3.3-70b-instruct.
3. **SambaNova Cloud**: Fast (~360ms), models: Meta-Llama-3.1-70B-Instruct, Qwen2.5-72B-Instruct.
4. **Mistral AI**: Highly reliable (~390ms), model: mistral-medium-latest.
5. **Google Gemini**: Massive 1,000,000 token context window (~710ms), model: gemini-2.0-flash.
6. **OpenRouter**: Free model pool (
emotron-free, mistral-free).
7. **Cloudflare Workers AI**: Edge inference (llama-3.1-8b).
8. **Cohere**: Trial tier (command-r-plus).

## Key Features & Architecture
- **1-Line Embeddable Chatbot**: Drop <script src='/widget.js' ...> on any HTML, Next.js, React, Vue, WordPress, Shopify, or Webflow site.
- **Zero-Database Knowledge Base**: Attach any .md, .txt, or .json file using data-knowledge-url or data-knowledge for instant /mo RAG.
- **Zero Runtime Dependencies**: Built purely with native Node.js HTTP and Fetch. Instant 0ms cold starts.
- **AES-256 Key Encryption**: Military-grade authenticated encrypted credentials vault for API keys.
- **Circuit Breaker Auto-Failover**: Auto-detects 429 rate limits or timeouts (<8ms) and seamlessly fails over to the next fastest provider.
- **In-Memory RAM Cache**: Exact duplicate questions replay instantly in 0ms without consuming any API tokens.

## Deployment Options
- **Vercel**: 1-Click Edge Serverless deployment (ercel.json + server.js).
- **Render**: 1-Click continuous Node.js service (ender.yaml).
- **Docker / Railway / Fly.io / VPS**: Multi-stage production container (docker compose up -d).

## Creator & Contact Information
- **Creator**: Amjad P A (Full-Stack AI Engineer & Solo Builder)
- **Portfolio**: [amjad.mapki.in](https://amjad.mapki.in)
- **GitHub**: [@amjadlle](https://github.com/amjadlle)
- **LinkedIn**: [in/amjadlle](https://linkedin.com/in/amjadlle)
- **Email**: [hire.amjad@gmail.com](mailto:hire.amjad@gmail.com)
- **License**: MIT License (100% Free for personal, commercial, and open-source use)
