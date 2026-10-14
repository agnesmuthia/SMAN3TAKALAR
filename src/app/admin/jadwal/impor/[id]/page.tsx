import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { requireSchoolAdmin } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";
import { semesterLabel } from "@/lib/school/labels";
import type { RowReport } from "@/lib/school/schedule-import";
import { commitScheduleImportAction, discardScheduleImportAction, revertScheduleImportAction } from "../../../sekolah/actions";

export const metadata: Metadata = { title: "Pratinjau Impor Jadwal" };

const ROW_STATUS: Record<RowReport["status"], { label: string; cls: string }> = {
  valid: { label: "Siap diimpor", cls: "bg-green-100 text-green-800" },
  sudah_ada: { label: "Sudah ada (dilewati)", cls: "bg-slate-100 text-slate-700" },
  error: { label: "Bermasalah", cls: "bg-red-100 text-red-800" },
};

type Batch = {
  id: string; file_name: string; status: "pratinjau" | "selesai" | "dibatalkan"; total_rows: number; valid_count: number;
  existing_count: number; error_count: number; inserted_count: number | null; report: RowReport[]; created_at: string;
  committed_at: string | null; reverted_at: string | null; semester: { term: number; year: { name: string } | null } | null;
};

export default async function PratinjauImporPage({ params, searchParams }: PageProps<"/admin/jadwal/impor/[id]">) {
  const { id } = await params;
  const ctx = await requireSchoolAdmin(`/admin/jadwal/impor/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: batch } = await ctx.supabase
    .from("schedule_import_batches")
    .select("id, file_name, status, total_rows, valid_count, existing_count, error_count, inserted_count, report, created_at, committed_at, reverted_at, semester:semester_id (term, year:academic_year_id (name))")
    .eq("id", id)
    .maybeSingle<Batch>();
  if (!batch) notFound();
  const onlyProblems = sp.tampil === "masalah";
  const rows = onlyProblems ? batch.report.filter((r) => r.status !== "valid") : batch.report;

  const stats = [
    { label: "Baris dibaca", value: batch.total_rows, cls: "text-navy-900" },
    { label: "Siap diimpor", value: batch.valid_count, cls: "text-green-700" },
    { label: "Sudah ada (dilewati)", value: batch.existing_count, cls: "text-slate-700" },
    { label: "Bermasalah", value: batch.error_count, cls: "text-red-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/jadwal/impor" className="text-sm text-teal-700 hover:underline">← Impor jadwal</Link>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">{batch.status === "pratinjau" ? "2. Pratinjau impor" : "Hasil impor"}</h1>
        <p className="text-sm text-slate-600">
          {batch.file_name} · {batch.semester ? semesterLabel(batch.semester) : "—"} · diperiksa {formatWaktuWita(batch.created_at)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {batch.status === "pratinjau" && (
        <section className="card space-y-3 border-l-4 !border-l-gold-500">
          <h2 className="font-semibold text-navy-900">3. Putuskan</h2>
          {batch.valid_count > 0 ? (
            <p className="text-sm text-slate-700">
              Hanya <strong>{batch.valid_count} baris</strong> berstatus &quot;Siap diimpor&quot; yang akan dimasukkan. Baris bermasalah dan yang sudah ada
              tidak diimpor; perbaiki di file lalu unggah ulang bila perlu.
            </p>
          ) : (
            <p className="text-sm text-slate-700">Tidak ada baris yang dapat diimpor. Perbaiki file sesuai laporan di bawah, lalu unggah ulang.</p>
          )}
          <div className="flex flex-wrap items-start gap-3">
            {batch.valid_count > 0 && (
              <ActionForm action={commitScheduleImportAction} submitLabel={`Impor ${batch.valid_count} baris`} pendingLabel="Mengimpor…" className="space-y-2" submitClassName="btn-primary">
                <input type="hidden" name="id" value={batch.id} />
              </ActionForm>
            )}
            <ActionForm action={discardScheduleImportAction} submitLabel="Buang pratinjau" className="space-y-2" submitClassName="btn-secondary">
              <input type="hidden" name="id" value={batch.id} />
            </ActionForm>
          </div>
        </section>
      )}

      {batch.status === "selesai" && (
        <section className="card space-y-3 border-l-4 !border-l-teal-600">
          <p className="text-sm text-slate-700">
            <strong>{batch.inserted_count ?? 0} sesi</strong> diimpor pada {batch.committed_at ? formatWaktuWita(batch.committed_at) : "—"}.{" "}
            <Link href="/admin/jadwal" className="font-semibold text-teal-700 hover:underline">Lihat jadwal</Link>
          </p>
          <details>
            <summary className="cursor-pointer text-sm text-red-700">Batalkan impor ini</summary>
            <ActionForm action={revertScheduleImportAction} submitLabel="Batalkan impor" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
              <input type="hidden" name="id" value={batch.id} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="confirm" required /> Hapus hanya sesi yang berasal dari file ini
              </label>
            </ActionForm>
          </details>
        </section>
      )}

      {batch.status === "dibatalkan" && (
        <p className="card text-sm text-slate-700">Impor ini dibatalkan pada {batch.reverted_at ? formatWaktuWita(batch.reverted_at) : "—"}. Sesi dari file ini sudah dihapus.</p>
      )}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-navy-900">Laporan per baris</h2>
          <nav className="flex gap-2 text-sm" aria-label="Saring laporan">
            <Link href={`/admin/jadwal/impor/${batch.id}`} aria-current={!onlyProblems ? "page" : undefined} className={!onlyProblems ? "font-semibold text-navy-900" : "text-teal-700 hover:underline"}>Semua</Link>
            <span aria-hidden>·</span>
            <Link href={`/admin/jadwal/impor/${batch.id}?tampil=masalah`} aria-current={onlyProblems ? "page" : undefined} className={onlyProblems ? "font-semibold text-navy-900" : "text-teal-700 hover:underline"}>Hanya yang tidak diimpor</Link>
          </nav>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Baris</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Kelas</th><th className="px-2 py-2">Hari</th>
                <th className="px-2 py-2">Jam</th><th className="px-2 py-2">Mapel</th><th className="px-2 py-2">Guru</th><th className="px-2 py-2">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.row} className="align-top">
                  <td className="px-2 py-2 font-mono text-xs">{r.row}</td>
                  <td className="px-2 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${ROW_STATUS[r.status].cls}`}>{ROW_STATUS[r.status].label}</span></td>
                  <td className="px-2 py-2">{r.values.kelas}</td>
                  <td className="px-2 py-2">{r.values.hari}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">{r.values.mulai}–{r.values.selesai}</td>
                  <td className="px-2 py-2">{r.values.mapel}</td>
                  <td className="px-2 py-2">{r.values.guru}</td>
                  <td className="px-2 py-2 text-xs text-slate-700">{r.messages.join(" ")}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-slate-500">Tidak ada baris untuk ditampilkan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
