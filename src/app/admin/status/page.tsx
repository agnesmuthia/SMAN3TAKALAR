import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";
import { checkConfig } from "@/lib/ops/config-status";

export const metadata: Metadata = { title: "Status Sistem" };

type SystemStatus = {
  checked_at: string;
  database: string;
  counts: Record<string, number>;
  migrations: { latest: string | null; count: number } | null;
  tables_without_rls: string[];
  buckets: { id: string; public: boolean }[];
  active_semester: string | null;
  pending: Record<string, number>;
  admins_active: number;
  last_audit_at: string | null;
};

const TABLE_LABEL: Record<string, string> = {
  profiles: "Akun", verification_requests: "Pengajuan verifikasi", staff_roles: "Peran staf", news: "Berita",
  news_revisions: "Revisi berita", announcements: "Pengumuman", newsletter_subscribers: "Pelanggan buletin",
  newsletter_campaigns: "Kampanye buletin", newsletter_deliveries: "Pengiriman email", site_pages: "Halaman",
  gallery_albums: "Album galeri", gallery_photos: "Foto galeri", achievements: "Prestasi", calendar_events: "Kegiatan kalender",
  academic_years: "Tahun ajaran", semesters: "Semester", schedule_entries: "Sesi jadwal", schedule_import_batches: "Impor jadwal",
  assignments: "Tugas & materi", decrees: "SK", library_items: "Koleksi perpustakaan", admin_audit_log: "Log aktivitas",
};

const PENDING_LABEL: Record<string, { label: string; href: string }> = {
  verifications: { label: "Verifikasi menunggu", href: "/admin/verifikasi" },
  news_review: { label: "Berita menunggu persetujuan", href: "/admin/berita?status=review" },
  import_previews: { label: "Pratinjau impor belum diputuskan", href: "/admin/jadwal/impor" },
  decrees_unverified: { label: "SK belum diperiksa", href: "/admin/arsip-sk" },
  deliveries_queued: { label: "Email dalam antrean", href: "/admin/langganan/kampanye" },
  deliveries_failed_7d: { label: "Email gagal/terpental (7 hari)", href: "/admin/langganan/kampanye" },
};

const EXPECTED_BUCKETS: Record<string, boolean> = { "news-images": true, "site-media": true, documents: false };

function Mark({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">OK</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${warn ? "bg-gold-500/20 text-navy-900" : "bg-red-100 text-red-800"}`}>{warn ? "Perlu diisi" : "Bermasalah"}</span>;
}

export default async function StatusSistemPage() {
  const ctx = await requireRole(["admin"], "/admin/status");
  const config = checkConfig(process.env);
  const { data, error } = await ctx.supabase.rpc("admin_system_status");
  const status = (error ? null : data) as SystemStatus | null;

  const warnings: string[] = [];
  if (status) {
    if (status.tables_without_rls.length > 0) warnings.push(`Tabel tanpa RLS: ${status.tables_without_rls.join(", ")}. Segera hubungi petugas teknis.`);
    if (status.admins_active < 2) warnings.push("Hanya ada satu Super Admin aktif. Tetapkan satu admin cadangan agar akses tidak terkunci.");
    if (!status.active_semester) warnings.push("Belum ada semester aktif.");
    for (const [id, isPublic] of Object.entries(EXPECTED_BUCKETS)) {
      const bucket = status.buckets.find((b) => b.id === id);
      if (!bucket) warnings.push(`Bucket penyimpanan "${id}" belum ada. Jalankan migrasi database.`);
      else if (bucket.public !== isPublic) warnings.push(`Bucket "${id}" seharusnya ${isPublic ? "publik" : "PRIVAT"}. Periksa Storage di Supabase.`);
    }
  }
  for (const c of config) if (c.required && !c.ok) warnings.push(`${c.label}: ${c.note}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Status Sistem</h1>
        <p className="text-sm text-slate-600">
          Pemeriksaan baca-saja untuk Super Admin. Nilai rahasia tidak pernah ditampilkan. Panduan: <code>docs/PANDUAN_OPERASIONAL_ADMIN.md</code>.
        </p>
      </div>

      {warnings.length > 0 ? (
        <section className="card border-l-4 !border-l-red-600">
          <h2 className="font-semibold text-red-800">Perlu perhatian</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      ) : (
        <section className="card border-l-4 !border-l-teal-600 text-sm text-slate-700">Tidak ada masalah yang terdeteksi oleh pemeriksaan otomatis.</section>
      )}

      <section className="card">
        <h2 className="font-semibold text-navy-900">Konfigurasi server</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2 pr-3">Pengaturan</th><th className="py-2 pr-3">Variabel</th><th className="py-2 pr-3">Status</th><th className="py-2">Keterangan</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {config.map((c) => (
              <tr key={c.key}>
                <td className="py-2 pr-3">{c.label}{!c.required && <span className="text-xs text-slate-500"> (opsional)</span>}</td>
                <td className="py-2 pr-3 font-mono text-xs">{c.key}</td>
                <td className="py-2 pr-3"><Mark ok={c.ok} warn={!c.required} /></td>
                <td className="py-2 text-slate-600">{c.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">Login Google dikonfigurasi di dasbor Supabase, sehingga tidak dapat diperiksa dari sini. Lihat docs/google-oauth.md.</p>
      </section>

      {!status ? (
        <section className="card border-l-4 !border-l-red-600 text-sm">
          Database tidak dapat diperiksa{error?.code === "PGRST202" || error?.message?.includes("admin_system_status") ? " (migrasi Tahap 6 belum diterapkan)" : ""}. Periksa koneksi Supabase dan migrasi.
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card"><p className="text-sm text-slate-500">PostgreSQL</p><p className="mt-1 text-xl font-bold text-navy-900">{status.database}</p></div>
            <div className="card">
              <p className="text-sm text-slate-500">Migrasi terakhir</p>
              <p className="mt-1 font-mono text-lg font-bold text-navy-900">{status.migrations?.latest ?? "tidak tercatat"}</p>
              {status.migrations && <p className="text-xs text-slate-500">{status.migrations.count} migrasi</p>}
            </div>
            <div className="card"><p className="text-sm text-slate-500">Semester aktif</p><p className="mt-1 text-xl font-bold text-navy-900">{status.active_semester ?? "—"}</p></div>
            <div className="card"><p className="text-sm text-slate-500">Super Admin aktif</p><p className="mt-1 text-3xl font-bold text-navy-900">{status.admins_active}</p></div>
          </section>

          <section className="card">
            <h2 className="font-semibold text-navy-900">Antrean & tindak lanjut</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(status.pending).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <Link href={PENDING_LABEL[k]?.href ?? "/admin"} className="text-teal-700 hover:underline">{PENDING_LABEL[k]?.label ?? k}</Link>
                  <span className={`font-bold ${v > 0 ? "text-navy-900" : "text-slate-400"}`}>{v}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h2 className="font-semibold text-navy-900">Jumlah data</h2>
              <table className="mt-3 w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(status.counts).map(([k, v]) => (
                    <tr key={k}><td className="py-1.5">{TABLE_LABEL[k] ?? k}</td><td className="py-1.5 text-right font-mono">{v.toLocaleString("id-ID")}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-navy-900">Penyimpanan file</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {status.buckets.map((b) => (
                    <li key={b.id} className="flex items-center justify-between">
                      <span className="font-mono">{b.id}</span>
                      <span className={b.public ? "text-slate-600" : "font-semibold text-navy-900"}>{b.public ? "Publik (baca)" : "Privat"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card text-sm text-slate-700">
                <h2 className="font-semibold text-navy-900">Keamanan data</h2>
                <p className="mt-2">Tabel tanpa RLS: <strong>{status.tables_without_rls.length === 0 ? "tidak ada" : status.tables_without_rls.join(", ")}</strong></p>
                <p className="mt-1">Aktivitas tercatat terakhir: {status.last_audit_at ? formatWaktuWita(status.last_audit_at) : "—"} · <Link href="/admin/log" className="text-teal-700 hover:underline">Log aktivitas</Link></p>
                <p className="mt-1 text-xs text-slate-500">Diperiksa {formatWaktuWita(status.checked_at)}.</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
