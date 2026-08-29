import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export type PersistedProviderConfig = {
  id: string;
  enabled: boolean;
  order: number;
  model?: string;
};

export type PersistedConfig = {
  providers: PersistedProviderConfig[];
};

const CONFIG_FILE = resolve(process.cwd(), "config.json");

export function loadConfig(): PersistedConfig | null {
  try {
    if (!existsSync(CONFIG_FILE)) return null;
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.providers)) {
      return parsed as PersistedConfig;
    }
  } catch (err) {
    console.error("Failed to load config.json:", err);
  }
  return null;
}

export function saveConfig(config: PersistedConfig): boolean {
  if (process.env.VERCEL === "1") {
    // Vercel filesystem is read-only (serverless)
    return true;
  }
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Failed to save config.json:", err);
    return false;
  }
}
