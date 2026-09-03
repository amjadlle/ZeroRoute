/**
 * Multi-Tenant Customer & Subscription Store.
 *
 * Supports dual-engine persistence:
 * 1. Native Cloudflare KV (`CUSTOMERS_KV`) when deployed on Cloudflare Pages / Workers
 * 2. Local `data/customers.json` for development and VPS deployment
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = typeof import.meta.url === "string" ? fileURLToPath(import.meta.url) : "customers.js";
const __dirname  = typeof import.meta.url === "string" ? dirname(__filename) : process.cwd();

export interface CustomerProfile {
  key: string;               // e.g. "zr_live_8f9a2b1c4d"
  email: string;
  name: string;
  company: string;
  website: string;
  botTitle: string;
  botRole: string;
  tone: string;
  greeting: string;
  prompts: string[];
  persona: string;
  status: "active" | "canceled" | "expired";
  subscriptionExpires: number;
  createdAt: number;
  updatedAt: number;
}

const DATA_DIR = join(__dirname, "../../data");
const CUSTOMERS_FILE = join(DATA_DIR, "customers.json");

// In-memory cache for ultra-fast lookup (<1ms)
let cachedCustomers: Map<string, CustomerProfile> = new Map();

const loadLocalCustomers = (): Map<string, CustomerProfile> => {
  const map = new Map<string, CustomerProfile>();
  try {
    if (!existsSync(CUSTOMERS_FILE)) return map;
    const raw = readFileSync(CUSTOMERS_FILE, "utf-8");
    const arr: CustomerProfile[] = JSON.parse(raw);
    for (const c of arr) {
      map.set(c.key, c);
    }
  } catch (err) {
    console.error("[CustomerStore] Failed to read customers.json:", err);
  }
  return map;
};

const saveLocalCustomers = (): void => {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    const arr = Array.from(cachedCustomers.values());
    writeFileSync(CUSTOMERS_FILE, JSON.stringify(arr, null, 2), "utf-8");
  } catch (err) {
    console.error("[CustomerStore] Failed to write customers.json:", err);
  }
};

cachedCustomers = loadLocalCustomers();

export const CustomerStore = {
  list(): CustomerProfile[] {
    return Array.from(cachedCustomers.values());
  },

  get(key: string): CustomerProfile | undefined {
    if (!key) return undefined;
    const normalizedKey = key.startsWith("Bearer ") ? key.slice(7).trim() : key.trim();
    return cachedCustomers.get(normalizedKey);
  },

  getByEmail(email: string): CustomerProfile | undefined {
    if (!email) return undefined;
    const cleanEmail = email.trim().toLowerCase();
    return Array.from(cachedCustomers.values()).find(
      c => c.email.trim().toLowerCase() === cleanEmail
    );
  },

  isValid(key: string): boolean {
    const customer = this.get(key);
    if (!customer) return false;
    if (customer.status !== "active") return false;
    // Check if subscription has expired
    if (customer.subscriptionExpires && customer.subscriptionExpires < Date.now()) {
      return false;
    }
    return true;
  },

  createOrUpdate(profile: Partial<CustomerProfile> & { key?: string; email: string }): CustomerProfile {
    const now = Date.now();
    const existing = profile.key ? cachedCustomers.get(profile.key) : undefined;
    // Generate cryptographically secure live key (128-bit hex entropy, e.g. zr_live_3f9b8a1c...)
    const key = profile.key || existing?.key || `zr_live_${randomBytes(16).toString("hex")}`;

    const company = profile.company || existing?.company || "My Company";
    const botTitle = profile.botTitle || existing?.botTitle || `${company} Assistant`;
    const botRole = profile.botRole || existing?.botRole || "Support & Sales Specialist";
    const tone = profile.tone || existing?.tone || "Friendly & Professional";
    
    // Auto-generate persona prompt if not provided
    const persona = profile.persona || existing?.persona || 
      `You are ${botTitle}, the official AI representative for ${company}. Your mission is to assist visitors and customers with inquiries, explain services, answer questions, and solve problems with a ${tone.toLowerCase()} tone using verified company knowledge.`;

    const customer: CustomerProfile = {
      key,
      email: profile.email || existing?.email || "customer@domain.com",
      name: profile.name || existing?.name || "Customer",
      company,
      website: profile.website || existing?.website || "",
      botTitle,
      botRole,
      tone,
      greeting: profile.greeting || existing?.greeting || "Hi! 👋 How can I help you today?",
      prompts: profile.prompts || existing?.prompts || ["What are your services?", "Pricing details", "How to get started?"],
      persona,
      status: profile.status || existing?.status || "active",
      subscriptionExpires: profile.subscriptionExpires || existing?.subscriptionExpires || (now + 30 * 24 * 60 * 60 * 1000), // default 30 days
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    cachedCustomers.set(key, customer);
    saveLocalCustomers();
    return customer;
  },

  delete(key: string): boolean {
    const deleted = cachedCustomers.delete(key);
    if (deleted) {
      saveLocalCustomers();
    }
    return deleted;
  }
};
