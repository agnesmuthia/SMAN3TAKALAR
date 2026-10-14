import { ActionForm } from "@/components/action-form";
import type { Assignment } from "@/lib/dashboard/data";
import { saveAssignmentAction } from "../../actions";

// Nilai datetime-local dalam WITA (UTC+8), konsisten dengan penyimpanan di action.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16);
}

export function AssignmentForm({ item }: { item?: Assignment }) {
  return (
    <ActionForm action={saveAssignmentAction} submitLabel={item ? "Simpan perubahan" : "Simpan"} submitClassName="btn-primary">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="kind" className="label">Jenis</label>
          <select id="kind" name="kind" defaultValue={item?.kind ?? "tugas"} className="input">
            <option value="tugas">Tugas</option>
            <option value="materi">Materi</option>
          </select>
        </div>
        <div>
          <label htmlFor="className" className="label">Kelas (mis. X-1)</label>
          <input id="className" name="className" required maxLength={40} defaultValue={item?.class_name} className="input" />
        </div>
        <div>
          <label htmlFor="dueAt" className="label">Tenggat (WITA, opsional)</label>
          <input id="dueAt" name="dueAt" type="datetime-local" defaultValue={toLocalInput(item?.due_at ?? null)} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="title" className="label">Judul</label>
        <input id="title" name="title" required minLength={3} maxLength={200} defaultValue={item?.title} className="input" />
      </div>
      <div>
        <label htmlFor="description" className="label">Deskripsi / instruksi</label>
        <textarea id="description" name="description" rows={5} maxLength={5000} defaultValue={item?.description} className="input" />
      </div>
      <div>
        <label htmlFor="linkUrl" className="label">Tautan materi (https, opsional)</label>
        <input id="linkUrl" name="linkUrl" type="url" defaultValue={item?.link_url ?? ""} className="input" />
        <p className="mt-1 text-xs text-slate-500">Belum ada unggah file; gunakan tautan ke layanan penyimpanan sekolah. Jangan menaruh data pribadi siswa.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={item?.published ?? false} />
        Terbitkan ke siswa kelas tersebut
      </label>
    </ActionForm>
  );
}
