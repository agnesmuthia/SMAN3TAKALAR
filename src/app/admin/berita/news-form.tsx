import { ActionForm } from "@/components/action-form";
import { saveNewsAction } from "../actions";

export type NewsFormValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  status: string;
  visibility: string;
  newsletter_eligible: boolean;
};

export function NewsForm({ values }: { values?: NewsFormValues }) {
  return (
    <ActionForm action={saveNewsAction} submitLabel="Simpan berita" submitClassName="btn-primary">
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <div>
        <label htmlFor="title" className="label">Judul</label>
        <input id="title" name="title" required minLength={3} maxLength={200} defaultValue={values?.title} className="input" />
      </div>
      <div>
        <label htmlFor="slug" className="label">Slug URL (kosongkan untuk otomatis)</label>
        <input id="slug" name="slug" maxLength={120} defaultValue={values?.slug} className="input" />
      </div>
      <div>
        <label htmlFor="excerpt" className="label">Ringkasan (tampil di daftar & email, maks. 400 karakter)</label>
        <textarea id="excerpt" name="excerpt" maxLength={400} rows={3} defaultValue={values?.excerpt} className="input" />
      </div>
      <div>
        <label htmlFor="content" className="label">Isi berita (pisahkan paragraf dengan baris kosong)</label>
        <textarea id="content" name="content" rows={12} defaultValue={values?.content} className="input" />
      </div>
      <div>
        <label htmlFor="coverImageUrl" className="label">URL gambar utama (https, opsional)</label>
        <input id="coverImageUrl" name="coverImageUrl" type="url" defaultValue={values?.cover_image_url ?? ""} className="input" />
        <p className="mt-1 text-xs text-slate-500">Pastikan gambar boleh dipublikasikan dan tidak menampilkan data pribadi siswa.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={values?.status ?? "draft"} className="input">
            <option value="draft">Draf</option>
            <option value="published">Terbit</option>
            <option value="archived">Arsip</option>
          </select>
        </div>
        <div>
          <label htmlFor="visibility" className="label">Akses</label>
          <select id="visibility" name="visibility" defaultValue={values?.visibility ?? "public"} className="input">
            <option value="public">Publik (semua pengunjung)</option>
            <option value="internal">Internal (hanya warga sekolah aktif)</option>
          </select>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="newsletterEligible" defaultChecked={values?.newsletter_eligible ?? true} className="mt-1" />
        <span>Boleh dimasukkan ke buletin email (hanya berlaku untuk berita publik yang terbit).</span>
      </label>
    </ActionForm>
  );
}
