import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/security/csp";

describe("buildCsp", () => {
  it("produksi: skrip hanya dengan nonce, tanpa eval, framing dilarang", () => {
    const csp = buildCsp("abc123", { dev: false, supabaseUrl: "https://proyek.supabase.co/" });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://proyek.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob: https: https://proyek.supabase.co");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
  it("pengembangan: mengizinkan eval & websocket HMR", () => {
    const csp = buildCsp("n", { dev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
  it("URL Supabase tidak valid diabaikan", () => {
    expect(buildCsp("n", { dev: false, supabaseUrl: "bukan url" })).toContain("connect-src 'self';");
  });
  it("nonce unik per permintaan", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});
