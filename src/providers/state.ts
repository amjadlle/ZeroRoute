/**
 * Shared runtime state for providers.
 *
 * Centralised here so that route handlers can import only what they need
 * without importing the entire server module. All mutations go through the
 * exported helpers so the shape is always consistent.
 */
import { providers } from "./providers.js";
import { loadConfig } from "../services/config.js";
import { isProviderConfigured } from "../services/secrets.js";
import type { ProviderRuntimeState } from "./types.js";

export const TIMEOUT_MS  = Number(process.env.TIMEOUT_MS  ?? 12000);
export const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 60000);

const configuredOrder = (process.env.PROVIDER_ORDER ?? "mistral,groq,cohere,cloudflare,sambanova,gemini,openrouter,nvidia")
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

const persisted = loadConfig();

export const runtimeStateMap = new Map<string, ProviderRuntimeState>();

providers.forEach((p, idx) => {
  const persistedEntry = persisted?.providers.find(x => x.id === p.id);
  const defaultOrder   = configuredOrder.includes(p.id)
    ? configuredOrder.indexOf(p.id) + 1
    : idx + 10;

  if (persistedEntry?.model) p.model = persistedEntry.model;

  runtimeStateMap.set(p.id, {
    id:                  p.id,
    name:                p.name,
    model:               p.model,
    enabled:             persistedEntry ? persistedEntry.enabled : true,
    order:               persistedEntry ? persistedEntry.order   : defaultOrder,
    configured:          isProviderConfigured(p.id),
    consecutiveFailures: 0,
    cooldownUntil:       0
  });
});

/** Returns all providers sorted by order, with fresh `configured` status. */
export const getRuntimeProviders = (): ProviderRuntimeState[] =>
  Array.from(runtimeStateMap.values())
    .map(p => { p.configured = isProviderConfigured(p.id); return p; })
    .sort((a, b) => a.order - b.order);

/**
 * Returns eligible providers for routing, optionally targeting a specific
 * provider or model by name. Ready providers come before cooling ones.
 */
export const getEligibleProviders = (requestedTarget?: string) => {
  const all   = getRuntimeProviders().filter(p => p.enabled);
  const now   = Date.now();
  const ready   = all.filter(p => !p.cooldownUntil || p.cooldownUntil <= now);
  const cooling = all.filter(p =>  p.cooldownUntil && p.cooldownUntil >  now);
  cooling.sort((a, b) => a.cooldownUntil - b.cooldownUntil);

  const ordered = [...ready, ...cooling]
    .map(p => ({ state: p, provider: providers.find(x => x.id === p.id)! }))
    .filter(x => Boolean(x.provider));

  if (requestedTarget && requestedTarget !== "auto" && requestedTarget !== "default") {
    const idx = ordered.findIndex(
      x => x.provider.id === requestedTarget ||
           x.provider.model.toLowerCase() === requestedTarget.toLowerCase()
    );
    if (idx !== -1) {
      const target = ordered.splice(idx, 1)[0];
      return [target, ...ordered];
    }
  }

  return ordered;
};
