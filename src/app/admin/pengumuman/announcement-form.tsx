import { ActionForm } from "@/components/action-form";
import { saveAnnouncementAction } from "../actions";

export type AnnouncementValues = { id?: string; title: string; body: string; audience: string; status: string };

export function AnnouncementForm({ values }: { values?: AnnouncementValues }) {
  return (
    <ActionForm action={saveAnnouncementAction} submitLabel="Simpan pengumuman" submitClassName="btn-primary">
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <div>
        <label htmlFor="title" className="label">Judul</label>
        <input id="title" name="title" required minLength={3} maxLength={200} defaultValue={values?.title} className="input" />
      </div>
      <div>
        <label htmlFor="body" className="label">Isi</label>
        <textarea id="body" name="body" rows={6} maxLength={5000} defaultValue={values?.body} className="input" />
        <p className="mt-1 text-xs text-slate-500">Pengumuman &quot;Publik&quot; tampil di website untuk semua pengunjung; lainnya hanya untuk warga sekolah yang login. Jangan memuat data pribadi atau data konseling siswa.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="audience" className="label">Ditujukan kepada</label>
          <select id="audience" name="audience" defaultValue={values?.audience ?? "semua"} className="input">
            <option value="publik">Publik (semua pengunjung website)</option>
            <option value="semua">Semua warga sekolah (perlu login)</option>
            <option value="guru">Guru</option>
            <option value="siswa">Siswa</option>
            <option value="guru_bk">Guru BK</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={values?.status ?? "draft"} className="input">
            <option value="draft">Draf</option>
            <option value="published">Terbit</option>
            <option value="archived">Arsip</option>
          </select>
        </div>
      </div>
    </ActionForm>
  );
}
