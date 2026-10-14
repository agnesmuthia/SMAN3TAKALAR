import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";
import { canAccessPath, resolvePostLoginDestination } from "@/lib/auth/routing";

describe("safeNextPath (anti open redirect)", () => {
  it.each([
    ["/dashboard/guru", "/dashboard/guru"],
    ["/berita/abc?x=1#y", "/berita/abc?x=1#y"],
    ["/akun", "/akun"],
  ])("menerima path internal %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/..//evil.example",
    "/./..//evil.example/x",
    "javascript:alert(1)",
    "evil.example",
    "/ok\nLocation: https://evil.example",
    "/auth/callback?next=//evil.example",
    "",
    null,
    undefined,
    `/${"a".repeat(600)}`,
  ])("menolak %s", (input) => {
    expect(safeNextPath(input as string | null | undefined)).toBe("/dashboard");
  });

  it("tidak pernah menghasilkan URL ke host lain", () => {
    const inputs = ["/%2F%2Fevil.example", "/./../evil", "/..//evil.example", "/%0d%0aSet-Cookie:x"];
    for (const input of inputs) {
      const out = safeNextPath(input);
      expect(new URL(out, "https://sekolah.test").host).toBe("sekolah.test");
      expect(out).not.toMatch(/[\r\n]/);
    }
  });
});

describe("resolvePostLoginDestination", () => {
  it("pengguna baru (Google) tanpa profil diarahkan melengkapi profil, bukan dashboard", () => {
    expect(resolvePostLoginDestination(null, "/dashboard/guru")).toBe("/akun/lengkapi-profil");
  });

  it("akun pending tidak mendapat akses privat walau meminta halaman guru", () => {
    expect(
      resolvePostLoginDestination({ role: null, status: "pending", hasOpenVerificationRequest: false }, "/dashboard/guru"),
    ).toBe("/akun/lengkapi-profil");
    expect(
      resolvePostLoginDestination({ role: null, status: "pending", hasOpenVerificationRequest: true }, "/admin"),
    ).toBe("/akun/menunggu");
  });

  it("akun nonaktif ditolak", () => {
    expect(
      resolvePostLoginDestination({ role: "guru", status: "disabled", hasOpenVerificationRequest: false }, null),
    ).toBe("/masuk?error=akun_nonaktif");
  });

  it("akun aktif diarahkan ke dashboard perannya", () => {
    const active = (role: "guru" | "siswa" | "guru_bk" | "admin") => ({ role, status: "active" as const, hasOpenVerificationRequest: false });
    expect(resolvePostLoginDestination(active("guru"), null)).toBe("/dashboard/guru");
    expect(resolvePostLoginDestination(active("siswa"), null)).toBe("/dashboard/siswa");
    expect(resolvePostLoginDestination(active("guru_bk"), null)).toBe("/dashboard/bk");
    expect(resolvePostLoginDestination(active("admin"), null)).toBe("/admin");
  });

  it("tujuan next hanya dipakai bila sesuai peran", () => {
    const siswa = { role: "siswa" as const, status: "active" as const, hasOpenVerificationRequest: false };
    expect(resolvePostLoginDestination(siswa, "/admin/langganan")).toBe("/dashboard/siswa");
    expect(resolvePostLoginDestination(siswa, "/dashboard/bk")).toBe("/dashboard/siswa");
    expect(resolvePostLoginDestination(siswa, "/berita/abc")).toBe("/berita/abc");
  });
});

describe("canAccessPath", () => {
  it("membatasi area per peran", () => {
    expect(canAccessPath("guru", "/admin")).toBe(false);
    expect(canAccessPath("guru", "/dashboard/bk")).toBe(false);
    expect(canAccessPath("guru_bk", "/dashboard/bk")).toBe(true);
    expect(canAccessPath("admin", "/admin/langganan")).toBe(true);
    expect(canAccessPath("siswa", "/adminx")).toBe(true);
  });
});
