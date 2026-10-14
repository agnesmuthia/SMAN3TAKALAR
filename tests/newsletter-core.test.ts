import { describe, expect, it } from "vitest";
import { emailHash, isSingleRecipient, isValidEmail, normalizeEmail } from "@/lib/newsletter/email";
import {
  generateConfirmationToken,
  hashToken,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/newsletter/tokens";
import { isDistributableNews } from "@/lib/newsletter/content-policy";
import { classifyResendEvent, verifyWebhookSignature } from "@/lib/newsletter/webhook";
import { createHmac } from "node:crypto";
import { csvCell } from "@/lib/csv";
import { slugify } from "@/lib/slug";

const SECRET = "rahasia-uji-yang-panjangnya-lebih-dari-32-karakter";
const SUB_ID = "20000000-0000-4000-8000-000000000001";

describe("email", () => {
  it("menormalkan dan memvalidasi alamat", () => {
    expect(normalizeEmail("  Pembaca@Contoh.Test ")).toBe("pembaca@contoh.test");
    expect(isValidEmail("pembaca@contoh.test")).toBe(true);
    expect(isValidEmail("bukan-email")).toBe(false);
    expect(isValidEmail(`${"a".repeat(250)}@x.test`)).toBe(false);
  });

  it("hash email sama dengan public.newsletter_email_hash (sha256 hex huruf kecil)", () => {
    expect(emailHash(" Pembaca.Satu@Contoh.test ")).toBe(emailHash("pembaca.satu@contoh.test"));
    expect(emailHash("a@b.test")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("menolak daftar penerima ganda", () => {
    expect(isSingleRecipient("a@contoh.test")).toBe(true);
    expect(isSingleRecipient("a@contoh.test,b@contoh.test")).toBe(false);
    expect(isSingleRecipient("a@contoh.test; b@contoh.test")).toBe(false);
  });
});

describe("token konfirmasi", () => {
  it("acak, panjang, dan hanya hash yang disimpan", () => {
    const a = generateConfirmationToken();
    const b = generateConfirmationToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
});

describe("token berhenti berlangganan", () => {
  it("dapat diverifikasi", () => {
    const token = signUnsubscribeToken(SUB_ID, 1, SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ subscriberId: SUB_ID, version: 1 });
  });

  it("menolak token yang diubah, versi lain, atau secret lain", () => {
    const token = signUnsubscribeToken(SUB_ID, 1, SECRET);
    const [id, , sig] = token.split(".");
    expect(verifyUnsubscribeToken(`${id}.2.${sig}`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token.replace(SUB_ID, "20000000-0000-4000-8000-000000000002"), SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, `${SECRET}-lain`)).toBeNull();
    expect(verifyUnsubscribeToken(`${token}x`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(null, SECRET)).toBeNull();
  });

  it("menolak secret yang terlalu pendek", () => {
    expect(() => signUnsubscribeToken(SUB_ID, 1, "pendek")).toThrow();
  });
});

describe("aturan distribusi buletin", () => {
  const now = new Date("2026-10-14T00:00:00Z");
  const base = { status: "published", visibility: "public", newsletter_eligible: true, published_at: "2026-10-13T00:00:00Z" };

  it("berita publik yang terbit boleh dikirim", () => {
    expect(isDistributableNews(base, now)).toBe(true);
  });

  it.each([
    ["draf", { ...base, status: "draft" }],
    ["arsip", { ...base, status: "archived" }],
    ["internal", { ...base, visibility: "internal" }],
    ["tidak diizinkan buletin", { ...base, newsletter_eligible: false }],
    ["terjadwal (belum waktunya)", { ...base, published_at: "2026-10-15T00:00:00Z" }],
    ["tanpa tanggal terbit", { ...base, published_at: null }],
  ])("berita %s tidak pernah dikirim", (_label, news) => {
    expect(isDistributableNews(news, now)).toBe(false);
  });
});

describe("webhook", () => {
  const secret = `whsec_${Buffer.from("kunci-webhook-uji").toString("base64")}`;
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "abc" } });
  const sign = (id: string, ts: string, payload: string) =>
    `v1,${createHmac("sha256", Buffer.from("kunci-webhook-uji")).update(`${id}.${ts}.${payload}`).digest("base64")}`;

  it("menerima tanda tangan valid", () => {
    const ts = "1760000000";
    expect(
      verifyWebhookSignature({ id: "msg_1", timestamp: ts, signatureHeader: sign("msg_1", ts, body), body, secret, nowSeconds: 1760000010 }),
    ).toBe(true);
  });

  it("menolak tanda tangan salah, payload diubah, atau timestamp kedaluwarsa", () => {
    const ts = "1760000000";
    const sig = sign("msg_1", ts, body);
    expect(verifyWebhookSignature({ id: "msg_1", timestamp: ts, signatureHeader: sig, body: `${body} `, secret, nowSeconds: 1760000010 })).toBe(false);
    expect(verifyWebhookSignature({ id: "msg_2", timestamp: ts, signatureHeader: sig, body, secret, nowSeconds: 1760000010 })).toBe(false);
    expect(verifyWebhookSignature({ id: "msg_1", timestamp: ts, signatureHeader: sig, body, secret, nowSeconds: 1760009999 })).toBe(false);
    expect(verifyWebhookSignature({ id: null, timestamp: ts, signatureHeader: sig, body, secret })).toBe(false);
  });

  it("mengklasifikasikan bounce permanen vs sementara", () => {
    expect(classifyResendEvent({ type: "email.bounced", data: { bounce: { type: "Permanent" } } })).toEqual({ kind: "bounced", permanent: true });
    expect(classifyResendEvent({ type: "email.bounced", data: { bounce: { type: "Transient" } } })).toEqual({ kind: "bounced", permanent: false });
    expect(classifyResendEvent({ type: "email.complained" })).toEqual({ kind: "complained" });
    expect(classifyResendEvent({ type: "email.opened" })).toEqual({ kind: "ignore" });
  });
});

describe("utilitas", () => {
  it("CSV mencegah injeksi rumus", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("biasa@contoh.test")).toBe("biasa@contoh.test");
  });

  it("slug aman untuk URL", () => {
    expect(slugify("Juara 1 Lomba Sains — Tingkat Provinsi!")).toBe("juara-1-lomba-sains-tingkat-provinsi");
    expect(slugify("Éxtra  spasi ")).toBe("extra-spasi");
  });
});
