# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

---

## Authentication Model

ZeroRoute uses two separate keys — **keep them different in production.**

| Key | Env Var | Protects | Risk if leaked |
|-----|---------|----------|----------------|
| Router key | `ROUTER_API_KEY` | `/v1/chat/*` | Users can consume your provider quotas |
| Admin key | `ADMIN_KEY` | `/api/*`, dashboard | Full control of your gateway config |

If `ROUTER_API_KEY` is not set, the gateway runs in **public mode** — any client can send chat requests. Useful for open deployments; use rate limiting and CORS to control access.

---

## Encrypted Key Storage

Provider API keys saved via the dashboard are:

1. Encrypted with **AES-256-GCM** using a unique IV per entry.
2. The encryption key is derived with **PBKDF2** (100,000 iterations, SHA-256) from a master secret.
3. Stored in `secrets.json` — the plaintext key is **never written to disk**.
4. The master secret is stored in `.master.key` (auto-generated on first run) or in the `MASTER_KEY` env var.
5. Keys are masked as `first4••••last4` in all API responses. Full secrets are never sent to the client.

---

## CORS

Set `CORS_ORIGIN` in `.env` to restrict which browser origins can call your gateway:

```env
CORS_ORIGIN=*.yourdomain.com   # recommended for production
```

Note: CORS only applies to browser requests. Direct API calls (curl, scripts) bypass CORS regardless of this setting. Use `ROUTER_API_KEY` + rate limiting for non-browser protection.

---

## Git Protection

The following files are in `.gitignore` by default and should **never be committed**:

- `.env` — your local keys and config
- `secrets.json` — encrypted key store
- `.master.key` — encryption master secret
- `config.json` — local provider order/settings

---

## Rate Limiting

| Endpoint | Limit |
|---|---|
| `POST /v1/chat/completions` | 60 req/min per IP |
| `POST /api/providers/:id/test` | 10 req/min per IP |

Limits are in-memory and reset on server restart. For production deployments with high traffic, consider adding a Redis-backed rate limiter.

---

## Reporting a Vulnerability

If you discover a security issue, **do NOT open a public GitHub issue.**

Report privately to: **📧 security@mapki.com**

Or open a [GitHub Security Advisory](https://github.com/amjadlle/zeroroute/security/advisories/new).

We will respond within 48 hours and issue a patch as quickly as possible.
