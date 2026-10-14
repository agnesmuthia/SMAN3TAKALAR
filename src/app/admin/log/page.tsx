import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/pager";
import { requireRole } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";
import { parsePage } from "@/lib/news-utils";

export const metadata: Metadata = { title: "Log Aktivitas" };

const PAGE_SIZE = 50;

const TARGET_LABEL: Record<string, string> = {
  profile: "Akun", newsletter_subscriber: "Pelanggan buletin", decrees: "Arsip SK", library_items: "Perpustakaan",
  academic_years: "Tahun ajaran", semesters: "Semester", schedule_import_batches: "Impor jadwal", site_profile: "Profil sekolah",
  site_pages: "Halaman", school_programs: "Program", gallery_albums: "Galeri", achievements: "Prestasi",
  calendar_events: "Kalender", announcements: "Pengumuman", news: "Berita",
};

const ACTION_LABEL: Record<string, string> = {
  "verification.approve": "Menyetujui verifikasi",
  "verification.reject": "Menolak verifikasi",
  "user.set_access": "Mengubah peran/status akun",
  "user.set_class": "Mengubah kelas siswa",
  "user.set_staff_roles": "Mengubah peran staf",
  "newsletter.anonymize": "Menganonimkan pelanggan",
};

function describe(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const [, op] = action.split(".");
  return op === "insert" ? "Menambah" : op === "update" ? "Mengubah" : op === "delete" ? "Menghapus" : action;
}

type Row = {
  id: number; action: string; target_type: string | null; target_id: string | null;
  details: { label?: string; changed?: string[]; [k: string]: unknown }; created_at: string; actor: { full_name: string | null } | null;
};

export default async function LogAktivitasPage({ searchParams }: PageProps<"/admin/log">) {
  const ctx = await requireRole(["admin"], "/admin/log");
  const sp = await searchParams;
  const page = parsePage(sp.halaman);
  const jenis = typeof sp.jenis === "string" && sp.jenis in TARGET_LABEL ? sp.jenis : "";
  let query = ctx.supabase
    .from("admin_audit_log")
    .select("id, action, target_type, target_id, details, created_at, actor:actor_id (full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (jenis) query = query.eq("target_type", jenis);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const lastPage = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Log Aktivitas</h1>
        <p className="text-sm text-slate-600">
          Catatan otomatis siapa mengubah apa. Isi konten tidak disalin ke log; hanya judul dan nama kolom yang berubah. Log tidak dapat diubah atau dihapus dari aplikasi.
        </p>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="jenis" className="label">Jenis data</label>
          <select id="jenis" name="jenis" defaultValue={jenis} className="input">
            <option value="">Semua</option>
            {Object.entries(TARGET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Terapkan</button>
        {jenis && <Link href="/admin/log" className="text-sm text-teal-700 hover:underline">Atur ulang</Link>}
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Waktu</th><th className="px-3 py-2">Pelaku</th><th className="px-3 py-2">Tindakan</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Rincian</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{formatWaktuWita(r.created_at)}</td>
                <td className="px-3 py-2">{r.actor?.full_name ?? <span className="text-slate-500">Sistem</span>}</td>
                <td className="px-3 py-2">{describe(r.action)}</td>
                <td className="px-3 py-2">
                  {r.target_type ? TARGET_LABEL[r.target_type] ?? r.target_type : "—"}
                  {r.details.label && <p className="text-xs text-slate-600">{r.details.label}</p>}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {Array.isArray(r.details.changed) ? `Kolom: ${r.details.changed.join(", ")}` : ""}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Belum ada aktivitas tercatat.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/log" params={{ jenis }} page={page} lastPage={lastPage} />
    </div>
  );
}
