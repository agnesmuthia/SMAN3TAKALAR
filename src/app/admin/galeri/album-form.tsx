import { ActionForm } from "@/components/action-form";
import { saveAlbumAction } from "../konten/actions";

export type AlbumValues = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  eventDate: string;
  isPublished: boolean;
  consentConfirmed: boolean;
};

export function AlbumForm({ values }: { values: AlbumValues }) {
  return (
    <ActionForm action={saveAlbumAction} submitLabel={values.id ? "Simpan album" : "Buat album"} submitClassName="btn-primary">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label" htmlFor="title">Judul album</label><input id="title" name="title" required minLength={3} maxLength={150} defaultValue={values.title} className="input" /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="description">Deskripsi (opsional)</label><textarea id="description" name="description" rows={2} maxLength={1000} defaultValue={values.description} className="input" /></div>
        <div><label className="label" htmlFor="eventDate">Tanggal kegiatan</label><input id="eventDate" name="eventDate" type="date" defaultValue={values.eventDate} className="input" /></div>
        <div><label className="label" htmlFor="slug">Alamat (slug) — kosongkan untuk otomatis</label><input id="slug" name="slug" maxLength={100} defaultValue={values.slug} className="input font-mono text-xs" /></div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {values.consentConfirmed ? (
          <p>Izin publikasi foto sudah dikonfirmasi untuk album ini.</p>
        ) : (
          <label className="flex items-start gap-2">
            <input type="checkbox" name="consent" className="mt-1" />
            <span>
              Saya memastikan semua foto di album ini boleh dipublikasikan (termasuk izin siswa/orang tua bila wajah
              siswa terlihat) dan tidak menampilkan data pribadi.
            </span>
          </label>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={values.isPublished} /> Tampilkan di website</label>
    </ActionForm>
  );
}
