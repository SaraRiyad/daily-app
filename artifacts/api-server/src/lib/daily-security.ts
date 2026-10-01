import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_BYTES = 64;
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  // Never accept untrusted work factors that could exhaust server resources.
  if (parts.length !== 6 || parts[0] !== "scrypt" ||
      parts[1] !== String(SCRYPT_N) || parts[2] !== String(SCRYPT_R) || parts[3] !== String(SCRYPT_P) ||
      !/^[a-f0-9]{32}$/.test(parts[4]!) || !/^[a-f0-9]{128}$/.test(parts[5]!)) return false;
  const actual = await derive(password, Buffer.from(parts[4]!, "hex"));
  return timingSafeEqual(actual, Buffer.from(parts[5]!, "hex"));
}

// Unknown accounts perform the same scrypt work as known accounts.
export const DUMMY_PASSWORD_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${"00".repeat(16)}$${"00".repeat(KEY_BYTES)}`;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newSessionToken = () => randomBytes(32).toString("base64url");

export function bearerTokenHash(header: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(header ?? "");
  return match ? digest(match[1]!) : null;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}