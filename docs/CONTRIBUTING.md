# Contributing to ZeroRoute

Thank you for contributing! ZeroRoute is built by the community, for the community.

## Quick Start

```bash
git clone https://github.com/amjadlle/zeroroute.git
cd ZeroRoute
cp .env.example .env   # add at least one provider API key
npm install
npm run dev            # http://localhost:8787
```

Read [ARCHITECTURE.md](./ARCHITECTURE.md) first — it explains every file in the codebase in one page.

## Where things live

```
src/middleware/  ← auth & rate limiting
src/providers/   ← AI provider implementations, state, and types
src/routes/      ← route handlers (chat, providers, keys, metrics, static, health)
src/services/    ← encryption, cache, telemetry, and config store
src/utils/       ← shared HTTP utilities & CORS
public/          ← landing page, dashboard UI, widget JS
```

## Adding a new AI provider

1. Open `src/providers/providers.ts` and add a new object to the `providers` array implementing:
   ```ts
   {
     id, name, model,
     generate(body, signal): Promise<ChatResponse>,
     generateStream(body, signal): Promise<AsyncIterable<ChatStreamChunk>>
   }
   ```
2. Add the key env var to `.env.example` with a comment linking to the provider's key page.
3. Add a case to `isProviderConfigured()` in `src/services/secrets.ts`.
4. Run `npm run build` — zero TypeScript errors means you're good.

## Pull Request guidelines

- **One change per PR.** Keep diffs small and focused.
- **`npm run build` must pass** with zero errors before opening a PR.
- **Zero external runtime dependencies.** Do not add packages to `dependencies` in `package.json`.
- Follow conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- Describe *why* the change is needed, not just what it does.

## Code style

- TypeScript strict mode is enabled — no `any` unless absolutely necessary.
- All API keys and credentials must remain masked and encrypted. Never log or transmit full keys.
- Route handlers return `true` if handled, `false` to fall through — keep that convention.

## Reporting issues

- **Security vulnerabilities** → see [SECURITY.md](./SECURITY.md). Do not open a public issue.
- **Bugs / feature requests** → open a GitHub Issue with steps to reproduce.
