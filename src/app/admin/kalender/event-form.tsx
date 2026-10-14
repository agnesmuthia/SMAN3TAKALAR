import { ActionForm } from "@/components/action-form";
import { EVENT_CATEGORY_LABEL, type EventCategory } from "@/lib/content/calendar";
import { saveEventAction } from "../konten/actions";

export type EventValues = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  starts_on: string;
  ends_on: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  visibility: "public" | "internal";
  is_published: boolean;
};

const CATEGORIES = Object.keys(EVENT_CATEGORY_LABEL) as EventCategory[];

export function EventForm({ values }: { values?: EventValues }) {
  const v = values;
  return (
    <ActionForm action={saveEventAction} submitLabel={v ? "Simpan perubahan" : "Tambah kegiatan"} submitClassName="btn-primary">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="e-title">Nama kegiatan</label>
            <input id="e-title" name="title" required minLength={3} maxLength={150} defaultValue={v?.title} className="input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="e-cat">Kategori</label>
              <select id="e-cat" name="category" defaultValue={v?.category ?? "kegiatan"} className="input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{EVENT_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="e-vis">Ditampilkan untuk</label>
              <select id="e-vis" name="visibility" defaultValue={v?.visibility ?? "public"} className="input">
                <option value="public">Publik (semua pengunjung)</option>
                <option value="internal">Internal (guru &amp; siswa terverifikasi)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="e-loc">Tempat (opsional)</label>
            <input id="e-loc" name="location" maxLength={150} defaultValue={v?.location ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="e-desc">Keterangan (opsional)</label>
            <textarea id="e-desc" name="description" rows={3} maxLength={1000} defaultValue={v?.description} className="input" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="e-start">Tanggal mulai</label>
              <input id="e-start" name="startsOn" type="date" required defaultValue={v?.starts_on} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="e-end">Tanggal selesai</label>
              <input id="e-end" name="endsOn" type="date" defaultValue={v && v.ends_on !== v.starts_on ? v.ends_on : ""} className="input" />
              <p className="mt-1 text-xs text-slate-500">Kosongkan bila hanya satu hari.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="e-st">Jam mulai (WITA, opsional)</label>
              <input id="e-st" name="startTime" type="time" defaultValue={v?.start_time?.slice(0, 5) ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="e-et">Jam selesai (opsional)</label>
              <input id="e-et" name="endTime" type="time" defaultValue={v?.end_time?.slice(0, 5) ?? ""} className="input" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={v?.is_published ?? false} /> Tampilkan di kalender</label>
        </div>
      </div>
    </ActionForm>
  );
}
