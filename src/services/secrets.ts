import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encrypt, decrypt } from "./crypto.js";

const SECRETS_FILE = resolve(process.cwd(), "secrets.json");

const ENV_MAP: Record<string, string> = {
  groq: "GROQ_API_KEY",
  sambanova: "SAMBANOVA_API_KEY",
  mistral: "MISTRAL_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  nvidia: "NVIDIA_API_KEY",
  cloudflare: "CLOUDFLARE_API_KEY",
  cohere: "COHERE_API_KEY"
};

type SecretsStore = Record<string, string>; // providerId -> encrypted ciphertext

// In-memory cache — avoids disk reads on every request
let _cachedStore: SecretsStore | null = null;

function loadSecretsStore(): SecretsStore {
  if (_cachedStore !== null) return _cachedStore;
  try {
    if (!existsSync(SECRETS_FILE)) {
      _cachedStore = {};
      return _cachedStore;
    }
    const raw = readFileSync(SECRETS_FILE, "utf-8");
    _cachedStore = JSON.parse(raw) as SecretsStore;
    return _cachedStore;
  } catch {
    _cachedStore = {};
    return _cachedStore;
  }
}

function saveSecretsStore(store: SecretsStore): boolean {
  try {
    writeFileSync(SECRETS_FILE, JSON.stringify(store, null, 2), "utf-8");
    _cachedStore = store; // keep cache in sync after write
    return true;
  } catch {
    return false;
  }
}

export function getProviderApiKey(providerId: string): string | undefined {
  // 1. Check environment variable (highest precedence for Docker / Vercel / Cloud)
  if (providerId === "cloudflare") {
    const cfToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY;
    if (cfToken && cfToken !== "your-cloudflare-api-token") {
      return cfToken.trim();
    }
  } else {
    const envVar = ENV_MAP[providerId];
    if (envVar && process.env[envVar] && process.env[envVar] !== `your-${providerId}-api-key`) {
      return process.env[envVar]?.trim();
    }
  }

  // 2. Check local encrypted secrets.json
  const store = loadSecretsStore();
  const encrypted = store[providerId];
  if (encrypted) {
    const decrypted = decrypt(encrypted);
    if (decrypted) return decrypted.trim();
  }

  return undefined;
}

export function isProviderConfigured(providerId: string): boolean {
  const key = getProviderApiKey(providerId);
  return Boolean(key && key.length > 5);
}

export function setProviderApiKey(providerId: string, apiKey: string): boolean {
  const store = loadSecretsStore();
  if (!apiKey || apiKey.trim() === "") {
    delete store[providerId];
  } else {
    store[providerId] = encrypt(apiKey.trim());
  }
  return saveSecretsStore(store);
}

export function deleteProviderApiKey(providerId: string): boolean {
  const store = loadSecretsStore();
  delete store[providerId];
  return saveSecretsStore(store);
}

export function maskKey(key?: string): string {
  if (!key || key.length < 6) return "Not configured";
  if (key.length <= 10) return `${key.slice(0, 2)}••••${key.slice(-2)}`;
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

export function getProviderCredentialsStatus(providerId: string): { configured: boolean; source: "env" | "ui" | "none"; masked: string } {
  if (providerId === "cloudflare") {
    const cfToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY;
    if (cfToken && cfToken !== "your-cloudflare-api-token") {
      return {
        configured: true,
        source: "env",
        masked: maskKey(cfToken)
      };
    }
  } else {
    const envVar = ENV_MAP[providerId];
    if (envVar && process.env[envVar] && process.env[envVar] !== `your-${providerId}-api-key`) {
      return {
        configured: true,
        source: "env",
        masked: maskKey(process.env[envVar])
      };
    }
  }

  const store = loadSecretsStore();
  if (store[providerId]) {
    const decrypted = decrypt(store[providerId]);
    if (decrypted) {
      return {
        configured: true,
        source: "ui",
        masked: maskKey(decrypted)
      };
    }
  }

  return {
    configured: false,
    source: "none",
    masked: "Not configured"
  };
}
