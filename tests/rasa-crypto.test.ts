import { describe, expect, it } from "vitest";
import {
  RASA_ALPHABET,
  decryptText,
  dummyVerify,
  encryptText,
  generateCode,
  generatePin,
  hashPin,
  normalizeCode,
  normalizePin,
  parseKey,
  rateKey,
  verifyPin,
} from "@/lib/rasa/crypto";

const key = Buffer.alloc(32, 7);

describe("enkripsi laporan", () => {
  it("bolak-balik, termasuk Unicode dan baris baru", () => {
    const text = "Dia mengejekku 🙁\nsetiap hari di kelas \\ dan \"kantin\"";
    const sealed = encryptText(text, "report:abc", key);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("mengejek");
    expect(decryptText(sealed, "report:abc", key)).toBe(text);
  });
  it("setiap enkripsi berbeda (IV acak)", () => {
    expect(encryptText("sama", "x", key)).not.toBe(encryptText("sama", "x", key));
  });
  it("menolak teks sandi yang diubah", () => {
    const sealed = encryptText("rahasia", "x", key);
    const [v, iv, tag, body] = sealed.split(".");
    const flipped = `${v}.${iv}.${tag}.${Buffer.from("palsu!!").toString("base64url")}`;
    expect(() => decryptText(flipped, "x", key)).toThrow();
    expect(() => decryptText(`${v}.${iv}.${Buffer.alloc(16).toString("base64url")}.${body}`, "x", key)).toThrow();
  });
  it("terikat pada konteks: tidak bisa dipindah ke laporan lain", () => {
    const sealed = encryptText("rahasia", "report:A", key);
    expect(() => decryptText(sealed, "report:B", key)).toThrow();
  });
  it("kunci salah ditolak; format asing ditolak", () => {
    const sealed = encryptText("rahasia", "x", key);
    expect(() => decryptText(sealed, "x", Buffer.alloc(32, 8))).toThrow();
    expect(() => decryptText("bukan-teks-sandi", "x", key)).toThrow();
  });
  it("kunci harus 32 byte base64", () => {
    expect(parseKey(Buffer.alloc(32, 1).toString("base64"))).toHaveLength(32);
    expect(parseKey(Buffer.alloc(16, 1).toString("base64"))).toBeNull();
    expect(parseKey("")).toBeNull();
    expect(parseKey(undefined)).toBeNull();
  });
});

describe("kode referensi & PIN", () => {
  it("format dan alfabet tanpa karakter membingungkan", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      const pin = generatePin();
      expect(code).toMatch(/^RSA-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      expect(pin).toMatch(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      expect([...code.replace(/RSA|-/g, "")].every((c) => RASA_ALPHABET.includes(c))).toBe(true);
    }
    expect(RASA_ALPHABET).toHaveLength(31);
    expect(RASA_ALPHABET).not.toMatch(/[ILO01]/);
  });
  it("tidak berulang pada 1000 pembangkitan", () => {
    expect(new Set(Array.from({ length: 1000 }, generateCode)).size).toBe(1000);
  });
  it("normalisasi masukan siswa", () => {
    expect(normalizeCode("rsa ab23 cd45")).toBe("RSA-AB23-CD45");
    expect(normalizeCode("AB23CD45")).toBe("RSA-AB23-CD45");
    expect(normalizeCode(" RSA-AB23-CD45 ")).toBe("RSA-AB23-CD45");
    expect(normalizeCode("RSA-AB23")).toBeNull();
    expect(normalizeCode("RSA-IO01-ABCD")).toBeNull();
    expect(normalizeCode("")).toBeNull();
    expect(normalizePin("ab23-cd45")).toBe("AB23-CD45");
    expect(normalizePin("ab23cd4")).toBeNull();
  });
  it("hash PIN: benar diterima, salah ditolak, garam berbeda", () => {
    const a = hashPin("AB23-CD45");
    const b = hashPin("AB23-CD45");
    expect(a.hash).not.toBe(b.hash);
    expect(a.hash).not.toContain("AB23");
    expect(verifyPin("AB23-CD45", a.salt, a.hash)).toBe(true);
    expect(verifyPin("ab23cd45", a.salt, a.hash)).toBe(true);
    expect(verifyPin("AB23-CD46", a.salt, a.hash)).toBe(false);
    expect(() => dummyVerify("AB23-CD45")).not.toThrow();
  });
  it("kunci rate limit tidak memuat nilai mentah dan stabil", () => {
    const k = rateKey("203.0.113.5", key);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("203");
    expect(rateKey("203.0.113.5", key)).toBe(k);
    expect(rateKey("203.0.113.6", key)).not.toBe(k);
  });
});
