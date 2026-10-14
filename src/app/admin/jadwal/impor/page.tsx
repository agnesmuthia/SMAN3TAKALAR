import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireSchoolAdmin } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";
import { semesterLabel } from "@/lib/school/labels";
import { listSemesters } from "@/lib/school/semesters";
import { previewScheduleImportAction } from "../../sekolah/actions";

export const metadata: Metadata = { title: "Impor Jadwal" };

const STATUS: Record<string, { label: string; cls: string }> = {
  pratinjau: { label: "Menunggu keputusan", cls: "bg-gold-500/20 text-navy-900" },
  selesai: { label: "Diimpor", cls: "bg-green-100 text-green-800" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-slate-100 text-slate-700" },
};

const COLUMNS = [
  ["Kelas", "Wajib", "Sama persis dengan kelas siswa, mis. X-1"],
  ["Hari", "Wajib", "Senin–Sabtu (atau angka 1–6)"],
  ["Jam Mulai", "Wajib", "07:30 atau 7.30 (WITA)"],
  ["Jam Selesai", "Wajib", "Harus setelah jam mulai"],
  ["Mata Pelajaran", "Wajib", "Maks. 100 karakter"],
  ["Guru", "Opsional", "Nama lengkap persis seperti di akun guru terverifikasi"],
  ["Ruang", "Opsional", "Maks. 40 karakter"],
];

export default async function ImporJadwalPage() {
  const ctx = await requireSchoolAdmin("/admin/jadwal/impor");
  const semesters = await listSemesters(ctx.supabase);
  const defaultSemester = semesters.find((s) => s.is_active) ?? semesters[0];
  const { data } = await ctx.supabase
    .from("schedule_import_batches")
    .select("id, file_name, status, total_rows, valid_count, existing_count, error_count, inserted_count, created_at, semester:semester_id (term, year:academic_year_id (name))")
    .order("created_at", { ascending: false })
    .limit(30);
  const batches = (data ?? []) as unknown as {
    id: string; file_name: string; status: string; total_rows: number; valid_count: number; existing_count: number;
    error_count: number; inserted_count: number | null; created_at: string; semester: { term: number; year: { name: string } | null } | null;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/jadwal" className="text-sm text-teal-700 hover:underline">← Jadwal</Link>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">Impor jadwal dari CSV/XLSX</h1>
        <p className="text-sm text-slate-600">
          File diperiksa dulu dan ditampilkan sebagai pratinjau. Tidak ada jadwal yang berubah sampai Anda menekan <strong>Impor</strong>.
          Jadwal yang sudah ada tidak pernah ditimpa.
        </p>
      </div>

      {semesters.length === 0 ? (
        <p className="card border-l-4 !border-l-gold-500 text-sm">
          Buat tahun ajaran dan semester terlebih dahulu di <Link href="/admin/tahun-ajaran" className="font-semibold text-teal-700 hover:underline">Tahun Ajaran</Link>.
        </p>
      ) : (
        <section className="card space-y-4">
          <h2 className="font-semibold text-navy-900">1. Unggah file</h2>
          <ActionForm action={previewScheduleImportAction} submitLabel="Periksa file" pendingLabel="Memeriksa…" submitClassName="btn-primary">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="semesterId" className="label">Semester tujuan</label>
                <select id="semesterId" name="semesterId" defaultValue={defaultSemester?.id} className="input">
                  {semesters.map((s) => <option key={s.id} value={s.id}>{semesterLabel(s)}{s.is_active ? " (aktif)" : ""}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="file" className="label">File jadwal (.xlsx atau .csv, maks. 2 MB / 2.000 baris)</label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
              </div>
            </div>
          </ActionForm>
          <p className="text-sm text-slate-600">
            Unduh templat kosong:{" "}
            <a href="/templat/templat-jadwal-pelajaran.xlsx" className="font-semibold text-teal-700 hover:underline" download>XLSX</a>
            {" · "}
            <a href="/templat/templat-jadwal-pelajaran.csv" className="font-semibold text-teal-700 hover:underline" download>CSV</a>
          </p>
          <details>
            <summary className="cursor-pointer text-sm text-teal-700">Format kolom</summary>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">Kolom</th><th className="py-1 pr-3">Status</th><th className="py-1">Keterangan</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {COLUMNS.map(([c, s, d]) => <tr key={c}><td className="py-1.5 pr-3 font-medium">{c}</td><td className="py-1.5 pr-3">{s}</td><td className="py-1.5 text-slate-600">{d}</td></tr>)}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">XLSX: hanya sheet pertama yang dibaca. CSV: pemisah koma atau titik koma, encoding UTF-8.</p>
          </details>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold text-navy-900">Riwayat impor</h2>
        {batches.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Belum ada impor.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-3">File</th><th className="py-2 pr-3">Semester</th><th className="py-2 pr-3">Baris</th><th className="py-2 pr-3">Hasil</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/jadwal/impor/${b.id}`} className="font-medium text-navy-900 hover:underline">{b.file_name}</Link>
                      <p className="text-xs text-slate-500">{formatWaktuWita(b.created_at)}</p>
                    </td>
                    <td className="py-2 pr-3">{b.semester ? semesterLabel(b.semester) : "—"}</td>
                    <td className="py-2 pr-3">{b.total_rows}</td>
                    <td className="py-2 pr-3 text-xs">
                      {b.status === "selesai" ? `${b.inserted_count ?? 0} masuk` : `${b.valid_count} valid`} · {b.existing_count} sudah ada · {b.error_count} bermasalah
                    </td>
                    <td className="py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[b.status]?.cls ?? ""}`}>{STATUS[b.status]?.label ?? b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
