// Dijalankan sekali saat server Next.js mulai. Mencatat ke log hosting
// konfigurasi wajib yang belum diisi (HANYA nama variabel, tanpa nilai) agar
// kesalahan deploy cepat terlihat. Tidak menghentikan server.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkConfig } = await import("@/lib/ops/config-status");
  const missing = checkConfig(process.env).filter((c) => c.required && !c.ok);
  if (missing.length === 0) {
    console.info("[startup] Konfigurasi wajib lengkap.");
    return;
  }
  for (const c of missing) console.warn(`[startup] Konfigurasi belum benar: ${c.key} — ${c.note}`);
  console.warn("[startup] Lihat docs/PANDUAN_DEPLOYMENT_HOSTINGER.md §4. Super Admin dapat memeriksa /admin/status.");
}
