import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "v1";

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "APP_ENCRYPTION_KEY belum diatur. Tambahkan 64 karakter hex di file .env.",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  // Terima base64 atau passphrase panjang, turunkan dengan SHA-256.
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return crypto.createHash("sha256").update(raw).digest();
}

/** Enkripsi AES-256-GCM. Format: v1:iv:tag:ciphertext (base64). */
export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(
    ":",
  );
}

export function decrypt(value: string): string {
  if (!value) return "";
  if (!value.startsWith(`${PREFIX}:`)) return value;
  try {
    const [, ivB64, tagB64, dataB64] = value.split(":");
    const decipher = crypto.createDecipheriv(
      ALGO,
      getKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Gagal mendekripsi data. Periksa APP_ENCRYPTION_KEY.");
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(`${PREFIX}:`));
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function randomPassword(length = 18): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (base.length < length) base.push(pick(all));
  for (let i = base.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}${"•".repeat(Math.min(12, value.length - 8))}${value.slice(-4)}`;
}

export function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
