import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  return createHash("sha256").update(process.env.MAIL_ENCRYPTION_KEY || "sigpsc-dev-mail").digest();
}

export function seal(plain: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const packed = Buffer.concat([iv, cipher.getAuthTag(), data]);
  const copy = new ArrayBuffer(packed.byteLength);
  const view = new Uint8Array(copy);
  view.set(packed);
  return view;
}

export function openSecret(payload: Buffer | Uint8Array): string {
  const buffer = Buffer.from(payload);
  const decipher = createDecipheriv("aes-256-gcm", key(), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString("utf8");
}
