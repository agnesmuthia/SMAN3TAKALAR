import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Token konfirmasi: 256 bit acak. Yang disimpan di database hanya hash-nya,
// sehingga kebocoran database tidak memungkinkan konfirmasi palsu.
export function generateConfirmationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export const CONFIRMATION_TOKEN_TTL_HOURS = 48;

// Token berhenti berlangganan: HMAC atas (id pelanggan, versi). Tidak
// disimpan di database; menaikkan versi di database membatalkan token lama.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function unsubscribeSignature(subscriberId: string, version: number, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${subscriberId}:${version}`).digest("base64url");
}

export function signUnsubscribeToken(subscriberId: string, version: number, secret: string): string {
  assertSecret(secret);
  return `${subscriberId}.${version}.${unsubscribeSignature(subscriberId, version, secret)}`;
}

export function verifyUnsubscribeToken(
  token: string | null | undefined,
  secret: string,
): { subscriberId: string; version: number } | null {
  assertSecret(secret);
  if (!token || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subscriberId, versionRaw, signature] = parts;
  if (!UUID_RE.test(subscriberId) || !/^[1-9][0-9]{0,8}$/.test(versionRaw)) return null;
  const version = Number(versionRaw);

  const expected = Buffer.from(unsubscribeSignature(subscriberId, version, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { subscriberId, version };
}

function assertSecret(secret: string) {
  if (!secret || secret.length < 32) {
    throw new Error("NEWSLETTER_TOKEN_SECRET wajib diisi minimal 32 karakter.");
  }
}

// Hash berkunci untuk IP/kunci rate limit agar alamat IP tidak tersimpan mentah.
export function keyedHash(value: string, secret: string): string {
  return createHmac("sha256", secret).update(`rl:${value}`).digest("hex");
}
