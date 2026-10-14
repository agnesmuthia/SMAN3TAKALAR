import { describe, expect, it } from "vitest";
import { checkConfig } from "@/lib/ops/config-status";

const byKey = (env: Record<string, string | undefined>) => Object.fromEntries(checkConfig(env).map((c) => [c.key, c]));

describe("checkConfig", () => {
  it("menandai placeholder .env.example sebagai belum diisi", () => {
    const r = byKey({
      NEXT_PUBLIC_SUPABASE_URL: "https://GANTI-PROJECT-REF.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "GANTI_DENGAN_SERVICE_ROLE_KEY",
      NEWSLETTER_TOKEN_SECRET: "GANTI_DENGAN_STRING_ACAK_MINIMAL_32_KARAKTER",
    });
    expect(r.NEXT_PUBLIC_SUPABASE_URL.ok).toBe(false);
    expect(r.SUPABASE_SERVICE_ROLE_KEY.ok).toBe(false);
    expect(r.NEWSLETTER_TOKEN_SECRET.ok).toBe(false);
  });

  it("tidak pernah mengembalikan nilai rahasia", () => {
    const secret = "sangat-rahasia-service-role-1234567890";
    const out = JSON.stringify(checkConfig({ SUPABASE_SERVICE_ROLE_KEY: secret, CRON_SECRET: "cron-rahasia-1234567", NEWSLETTER_TOKEN_SECRET: "x".repeat(40) }));
    expect(out).not.toContain(secret);
    expect(out).not.toContain("cron-rahasia");
    expect(out).not.toContain("x".repeat(40));
  });

  it("alamat situs harus https di produksi", () => {
    expect(byKey({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).NEXT_PUBLIC_SITE_URL.ok).toBe(false);
    expect(byKey({ NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).NEXT_PUBLIC_SITE_URL.ok).toBe(true);
    expect(byKey({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://sekolah.sch.id" }).NEXT_PUBLIC_SITE_URL.ok).toBe(true);
  });

  it("memeriksa panjang rahasia dan format webhook", () => {
    const r = byKey({ NEWSLETTER_TOKEN_SECRET: "pendek", CRON_SECRET: "abc", RESEND_WEBHOOK_SECRET: "salah" });
    expect(r.NEWSLETTER_TOKEN_SECRET.note).toContain("32");
    expect(r.CRON_SECRET.ok).toBe(false);
    expect(r.RESEND_WEBHOOK_SECRET.ok).toBe(false);
    expect(byKey({ RESEND_WEBHOOK_SECRET: "whsec_abc" }).RESEND_WEBHOOK_SECRET.ok).toBe(true);
  });
});
