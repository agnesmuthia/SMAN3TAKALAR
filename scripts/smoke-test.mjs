#!/usr/bin/env node
// Smoke test setelah deploy (atau lokal): halaman publik terbuka, halaman
// privat menolak pengunjung tanpa login, header keamanan terpasang, dan
// endpoint mesin menolak permintaan tanpa izin. Hanya membaca (GET).
//
//   node scripts/smoke-test.mjs https://domain-sekolah.sch.id
const base = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Pemakaian: node scripts/smoke-test.mjs <URL situs>");
  process.exit(2);
}

const PUBLIC = ["/", "/berita", "/profil", "/pengumuman", "/galeri", "/prestasi", "/kalender", "/perpustakaan", "/dokumen",
  "/masuk", "/daftar", "/lupa-password", "/kebijakan-privasi"];
const PRIVATE = ["/admin", "/admin/status", "/admin/log", "/admin/berita", "/admin/arsip-sk", "/admin/jadwal/impor", "/dashboard", "/dashboard/siswa", "/akun"];

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const get = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init });

for (const path of PUBLIC) {
  try {
    const res = await get(path);
    check(`publik ${path}`, res.status === 200, `status ${res.status}`);
  } catch (error) {
    check(`publik ${path}`, false, String(error));
  }
}
for (const path of PRIVATE) {
  const res = await get(path);
  const location = res.headers.get("location") ?? "";
  check(`privat ${path} → masuk`, res.status >= 300 && res.status < 400 && location.includes("/masuk"), `status ${res.status} ${location}`);
}

const home = await get("/");
const csp = home.headers.get("content-security-policy") ?? "";
check("CSP dengan nonce", /script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/.test(csp), csp ? "" : "header tidak ada");
check("CSP melarang framing & plugin", csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"));
check("CSP tanpa unsafe-eval di skrip", !/script-src[^;]*unsafe-eval/.test(csp) || base.includes("localhost"));
const csp2 = (await get("/")).headers.get("content-security-policy") ?? "";
const nonce = (v) => v.match(/'nonce-([^']+)'/)?.[1];
check("nonce berbeda tiap permintaan", Boolean(nonce(csp)) && nonce(csp) !== nonce(csp2));
check("X-Frame-Options DENY", home.headers.get("x-frame-options") === "DENY");
check("X-Content-Type-Options nosniff", home.headers.get("x-content-type-options") === "nosniff");
check("Referrer-Policy", Boolean(home.headers.get("referrer-policy")));
check("Tanpa X-Powered-By", !home.headers.get("x-powered-by"));
if (base.startsWith("https://")) check("HSTS", (home.headers.get("strict-transport-security") ?? "").includes("max-age="));

const health = await get("/api/health");
const healthBody = await health.json().catch(() => ({}));
check("health: aplikasi & database", health.status === 200 && healthBody.database === "ok", `status ${health.status} database=${healthBody.database}`);
check("health tidak membuka versi/konfigurasi", Object.keys(healthBody).sort().join(",") === "database,status,time");
check("cron menolak tanpa rahasia", (await get("/api/cron/newsletter")).status === 401);
check("webhook menolak GET", (await get("/api/newsletter/webhook")).status >= 400);
check("unduh SK acak → 404", (await get("/dokumen/00000000-0000-4000-8000-000000000000/unduh")).status === 404);
check("halaman tidak ada → 404", (await get("/halaman-yang-tidak-ada-xyz")).status === 404);

const width = Math.max(...results.map((r) => r.name.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(width)} ${r.ok ? "" : r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} pemeriksaan GAGAL.` : `\nSemua ${results.length} pemeriksaan lulus.`);
process.exit(failed ? 1 : 0);
