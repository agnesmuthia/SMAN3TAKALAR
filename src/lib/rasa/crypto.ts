// Kriptografi Ruang Rasa (murni, tanpa akses database/jaringan).
//  - Isi laporan & pesan dienkripsi AES-256-GCM SEBELUM masuk database.
//    Setiap teks sandi terikat pada konteksnya (AAD), sehingga teks sandi
//    tidak dapat dipindahkan ke baris lain tanpa terdeteksi.
//  - Kode referensi & PIN memakai alfabet tanpa karakter yang membingungkan
//    (tanpa I, L, O, 0, 1). PIN disimpan sebagai hash scrypt berkunci garam.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export const RASA_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const VERSION = "v1";

// Kunci: 32 byte dalam base64 (openssl rand -base64 32).
export function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  try {
    const key = Buffer.from(raw.trim(), "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptText(plain: string, aad: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptText(payload: string, aad: string, key: Buffer): string {
  const [version, iv, tag, body] = payload.split(".");
  if (version !== VERSION || !iv || !tag || body === undefined) throw new Error("format_tidak_dikenal");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

function randomChars(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += RASA_ALPHABET[randomInt(RASA_ALPHABET.length)];
  return out;
}

export function generateCode(): string {
  const raw = randomChars(8);
  return `RSA-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function generatePin(): string {
  const raw = randomChars(8);
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function clean(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
const allInAlphabet = (value: string) => [...value].every((c) => RASA_ALPHABET.includes(c));

// Menerima "rsa ab23 cd45", "RSA-AB23-CD45", dst. Mengembalikan bentuk baku atau null.
export function normalizeCode(input: string): string | null {
  let raw = clean(input);
  if (raw.startsWith("RSA")) raw = raw.slice(3);
  if (raw.length !== 8 || !allInAlphabet(raw)) return null;
  return `RSA-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizePin(input: string): string | null {
  const raw = clean(input);
  if (raw.length !== 8 || !allInAlphabet(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export function hashPin(pin: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(clean(pin), salt, 32, SCRYPT).toString("hex");
  return { salt, hash };
}

export function verifyPin(pin: string, salt: string, hash: string): boolean {
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(clean(pin), salt, expected.length || 32, SCRYPT);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Dipanggil bila kode tidak ditemukan agar waktu respons tidak membedakan
// "kode tidak ada" dari "PIN salah".
const DUMMY_SALT = "00000000000000000000000000000000";
export function dummyVerify(pin: string): void {
  scryptSync(clean(pin), DUMMY_SALT, 32, SCRYPT);
}

// Hash berkunci untuk kunci rate limit (IP/kode tidak tersimpan mentah).
export function rateKey(value: string, key: Buffer): string {
  return createHmac("sha256", key).update(`rasa-rl:${value}`).digest("hex");
}
