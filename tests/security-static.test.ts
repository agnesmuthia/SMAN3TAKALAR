// Pemeriksaan statis keamanan: mencegah regresi saat kode bertambah.
// Bila tes ini gagal karena perubahan yang disengaja, tinjau dulu risikonya,
// lalu perbarui daftar izin di bawah beserta alasannya.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
const files = walk(SRC).map((path) => ({ path: relative(ROOT, path), text: readFileSync(path, "utf8") }));

describe("server action", () => {
  const GUARD = /await (guard|contentPublisher|newsActionContext|staffActionContext|publisher|schoolAdmin|libraryManager|requireUser|activeMember|activeTeacher)\(/;
  // Aksi publik yang memang tanpa login; masing-masing punya perlindungan lain.
  const PUBLIC = new Set([
    "signInAction", // Supabase Auth + rate limit bawaan Supabase
    "signUpAction",
    "forgotPasswordAction",
    "resetPasswordAction", // butuh sesi pemulihan dari tautan email
    "subscribeAction", // rate limit + double opt-in
    "confirmAction", // token hash sekali pakai
    "unsubscribeAction", // token HMAC
  ]);
  const actionFiles = files.filter((f) => /^\s*["']use server["']/.test(f.text));

  it("menemukan file server action", () => {
    expect(actionFiles.length).toBeGreaterThan(5);
  });

  for (const file of actionFiles) {
    const chunks = file.text.split(/^export async function /m).slice(1);
    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf("("));
      it(`${file.path} → ${name} memeriksa izin di awal`, () => {
        if (PUBLIC.has(name)) return;
        const head = chunk.split("\n").slice(0, 6).join("\n");
        expect(head, `${name} harus memanggil fungsi pemeriksa izin di baris awal`).toMatch(GUARD);
      });
    }
  }
});

describe("service role (melewati RLS)", () => {
  // Setiap pemakaian harus didahului pemeriksaan izin eksplisit atau memang
  // alur tanpa sesi (webhook, cron, langganan publik).
  const ALLOWED = [
    "src/app/admin/actions.ts", // Super Admin: ban/unban akun Auth
    "src/app/admin/berita/[id]/page.tsx", // nama editor revisi (setelah cek akses CMS)
    "src/app/admin/berita/page.tsx", // nama penulis (setelah cek akses CMS)
    "src/app/admin/langganan/ekspor/route.ts", // catat log ekspor (setelah assertAdmin)
    "src/app/admin/pengguna/page.tsx", // daftar akun Auth (Super Admin)
    "src/app/api/cron/newsletter/route.ts", // cron dengan CRON_SECRET
    "src/app/api/newsletter/webhook/route.ts", // webhook bertanda tangan Svix
    "src/lib/cms/storage.ts", // unggah file (dipanggil setelah cek izin)
    "src/lib/newsletter/service.ts", // alur langganan publik
    "src/lib/school/documents.ts", // PDF privat (setelah cek izin/RLS)
    "src/lib/supabase/admin.ts", // definisi klien
  ].sort();

  it("hanya dipakai di file yang sudah ditinjau", () => {
    const using = files.filter((f) => f.text.includes("@/lib/supabase/admin") || f.path === "src/lib/supabase/admin.ts").map((f) => f.path).sort();
    expect(using).toEqual(ALLOWED);
  });

  it("tidak pernah diimpor dari komponen klien", () => {
    const offenders = files.filter((f) => /^\s*["']use client["']/.test(f.text) && /supabase\/admin|SERVICE_ROLE/.test(f.text));
    expect(offenders.map((f) => f.path)).toEqual([]);
  });
});

describe("rahasia & HTML", () => {
  it("tidak ada variabel NEXT_PUBLIC_ yang berisi rahasia", () => {
    const names = new Set(files.flatMap((f) => [...f.text.matchAll(/NEXT_PUBLIC_[A-Z_]+/g)].map((m) => m[0])));
    expect([...names].filter((n) => /SECRET|SERVICE|PRIVATE|PASSWORD|TOKEN/.test(n))).toEqual([]);
  });

  it("dangerouslySetInnerHTML hanya di komponen yang menyanitasi ulang", () => {
    const using = files.filter((f) => f.text.includes("dangerouslySetInnerHTML")).map((f) => f.path);
    expect(using).toEqual(["src/components/article-body.tsx"]);
    const body = files.find((f) => f.path === "src/components/article-body.tsx")!.text;
    expect(body).toContain("sanitizeNewsHtml(");
  });

  it("tidak ada eval atau new Function", () => {
    const offenders = files.filter((f) => /\beval\(|new Function\(/.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("tidak ada kunci/token tertanam di kode", () => {
    const pattern = /(eyJhbGciOi[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|re_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9+/=]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
    const offenders = files.filter((f) => pattern.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
