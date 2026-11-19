import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import argon2 from "argon2";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith("$argon2")) return argon2.verify(hash, password);
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) return bcrypt.compare(password, hash);
  return false;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function verificationCode(length = 16): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let index = 0; index < length; index += 1) code += alphabet[bytes[index]! % alphabet.length];
  return code;
}

function hotp(secret: Buffer, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}

export function createTotpSecret(): string {
  return randomBytes(20).toString("base64url");
}

export function verifyTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const key = Buffer.from(secret, "base64url");
  const counter = Math.floor(Date.now() / 30_000);
  for (let drift = -1; drift <= 1; drift += 1) {
    const expected = Buffer.from(hotp(key, counter + drift));
    const given = Buffer.from(token);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return true;
  }
  return false;
}

export function totpUri(secret: string, email: string): string {
  return `otpauth://totp/SIGPSC:${encodeURIComponent(email)}?secret=${encodeURIComponent(secret)}&issuer=SIGPSC&algorithm=SHA1&digits=6&period=30`;
}
