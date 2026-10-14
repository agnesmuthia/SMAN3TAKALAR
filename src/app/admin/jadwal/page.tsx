import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireSchoolAdmin } from "@/lib/auth/dal";
import { DAY_LABEL, formatTime, type ScheduleEntry } from "@/lib/dashboard/schedule";
import { semesterLabel } from "@/lib/school/labels";
import { listSemesters, pickSemester } from "@/lib/school/semesters";
import { deleteScheduleEntryAction, saveScheduleEntryAction } from "../sekolah/actions";

export const metadata: Metadata = { title: "Jadwal pelajaran" };

export default async function AdminJadwalPage({ searchParams }: PageProps<"/admin/jadwal">) {
  const ctx = await requireSchoolAdmin("/admin/jadwal");
  const sp = await searchParams;
  const kelas = typeof sp.kelas === "string" ? sp.kelas.trim().slice(0, 40) : "";
  const semesters = await listSemesters(ctx.supabase);
  const selected = pickSemester(semesters, sp.semester);

  let query = ctx.supabase
    .from("schedule_entries")
    .select("id, class_name, day_of_week, start_time, end_time, subject, room, teacher_id, import_batch_id")
    .order("class_name")
    .order("day_of_week")
    .order("start_time")
    .limit(500);
  query = selected === "lama" || selected === null ? query.is("semester_id", null) : query.eq("semester_id", selected.id);
  if (kelas) query = query.eq("class_name", kelas);

  const [{ data }, { data: teachers }] = await Promise.all([
    query,
    ctx.supabase.rpc("list_active_teachers"),
  ]);
  const entries = (data ?? []) as (ScheduleEntry & { import_batch_id: string | null })[];
  const teacherRows = (teachers ?? []) as { id: string; full_name: string | null }[];
  const teacherName = new Map(teacherRows.map((t) => [t.id, t.full_name ?? "(tanpa nama)"]));
  const semesterParam = selected === "lama" ? "lama" : selected?.id ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Jadwal pelajaran</h1>
          <p className="text-sm text-slate-600">Siswa dan guru melihat jadwal semester aktif.</p>
        </div>
        <Link href="/admin/jadwal/impor" className="btn-primary">Impor dari CSV/XLSX</Link>
      </div>

      {semesters.length === 0 && (
        <p className="card border-l-4 !border-l-gold-500 text-sm">
          Belum ada semester. Buat di <Link href="/admin/tahun-ajaran" className="font-semibold text-teal-700 hover:underline">Tahun Ajaran</Link> agar jadwal baru dapat dikaitkan ke semester.
        </p>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="semester" className="label">Semester</label>
          <select id="semester" name="semester" defaultValue={semesterParam} className="input">
            {semesters.map((s) => <option key={s.id} value={s.id}>{semesterLabel(s)}{s.is_active ? " (aktif)" : ""}</option>)}
            <option value="lama">Jadwal lama (tanpa semester)</option>
          </select>
        </div>
        <div>
          <label htmlFor="kelas" className="label">Filter kelas</label>
          <input id="kelas" name="kelas" defaultValue={kelas} className="input" placeholder="mis. X-1" />
        </div>
        <button type="submit" className="btn-secondary">Terapkan</button>
      </form>

      {selected && selected !== "lama" && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">Tambah sesi · {semesterLabel(selected)}</h2>
          <ActionForm action={saveScheduleEntryAction} submitLabel="Tambah" submitClassName="btn-primary">
            <input type="hidden" name="semesterId" value={selected.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="className" className="label">Kelas (sama persis dengan kelas siswa, mis. X-1)</label>
                <input id="className" name="className" required maxLength={40} className="input" />
              </div>
              <div>
                <label htmlFor="day" className="label">Hari</label>
                <select id="day" name="day" className="input">
                  {Object.entries(DAY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="subject" className="label">Mata pelajaran</label>
                <input id="subject" name="subject" required maxLength={100} className="input" />
              </div>
              <div>
                <label htmlFor="start" className="label">Mulai</label>
                <input id="start" name="start" type="time" required className="input" />
              </div>
              <div>
                <label htmlFor="end" className="label">Selesai</label>
                <input id="end" name="end" type="time" required className="input" />
              </div>
              <div>
                <label htmlFor="room" className="label">Ruang (opsional)</label>
                <input id="room" name="room" maxLength={40} className="input" />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="teacherId" className="label">Guru pengampu</label>
                <select id="teacherId" name="teacherId" className="input">
                  <option value="">(belum ditentukan)</option>
                  {teacherRows.map((t) => <option key={t.id} value={t.id}>{t.full_name ?? t.id}</option>)}
                </select>
              </div>
            </div>
          </ActionForm>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-surface text-left text-slate-600">
            <tr><th className="px-4 py-2">Kelas</th><th className="px-4 py-2">Hari</th><th className="px-4 py-2">Jam</th><th className="px-4 py-2">Mapel</th><th className="px-4 py-2">Guru</th><th className="px-4 py-2">Sumber</th><th className="px-4 py-2"><span className="sr-only">Aksi</span></th></tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{e.class_name}</td>
                <td className="px-4 py-2">{DAY_LABEL[e.day_of_week]}</td>
                <td className="px-4 py-2 font-mono">{formatTime(e.start_time)}–{formatTime(e.end_time)}</td>
                <td className="px-4 py-2">{e.subject}{e.room ? ` (${e.room})` : ""}</td>
                <td className="px-4 py-2">{e.teacher_id ? teacherName.get(e.teacher_id) ?? "—" : "—"}</td>
                <td className="px-4 py-2 text-xs">{e.import_batch_id ? <Link href={`/admin/jadwal/impor/${e.import_batch_id}`} className="text-teal-700 hover:underline">Impor</Link> : "Manual"}</td>
                <td className="px-4 py-2">
                  <ActionForm action={deleteScheduleEntryAction} submitLabel="Hapus" className="" submitClassName="text-xs font-semibold text-red-700 hover:underline">
                    <input type="hidden" name="id" value={e.id} />
                  </ActionForm>
                </td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Belum ada jadwal.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
