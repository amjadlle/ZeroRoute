import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ALGORITHM = "aes-256-gcm";
const KEY_FILE = resolve(process.cwd(), ".master.key");

// Get or generate a persistent local master encryption key for this machine
function getMasterKey(): Buffer {
  // If user set an explicit MASTER_KEY in env, use it
  if (process.env.MASTER_KEY && process.env.MASTER_KEY.length >= 16) {
    return scryptSync(process.env.MASTER_KEY, "ai-router-salt", 32);
  }

  // Otherwise, maintain a local machine key file (.master.key)
  try {
    if (existsSync(KEY_FILE)) {
      const raw = readFileSync(KEY_FILE, "utf-8").trim();
      if (raw.length === 64) {
        return Buffer.from(raw, "hex");
      }
    }
  } catch {}

  const newKey = randomBytes(32);
  try {
    writeFileSync(KEY_FILE, newKey.toString("hex"), "utf-8");
  } catch {}
  return newKey;
}

export function encrypt(plaintext: string): string {
  const masterKey = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  
  let encrypted = cipher.update(plaintext, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  try {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return "";

    const masterKey = getMasterKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  } catch (err) {
    return "";
  }
}
