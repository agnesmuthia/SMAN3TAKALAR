import { ActionForm } from "@/components/action-form";
import { RichTextEditor } from "@/components/cms/rich-text-editor";
import { savePageAction } from "../konten/actions";

export type PageValues = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  contentHtml: string;
  position: number;
  isPublished: boolean;
};

export function PageForm({ values }: { values: PageValues }) {
  return (
    <ActionForm action={savePageAction} submitLabel="Simpan halaman" className="space-y-6" submitClassName="btn-primary">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="card space-y-4">
        <div>
          <label htmlFor="title" className="label">Judul halaman (mis. Visi dan Misi)</label>
          <input id="title" name="title" required minLength={2} maxLength={120} defaultValue={values.title} className="input !text-lg !font-semibold" />
        </div>
        <div>
          <label htmlFor="summary" className="label">Ringkasan singkat (tampil di daftar halaman)</label>
          <textarea id="summary" name="summary" rows={2} maxLength={300} defaultValue={values.summary} className="input" />
        </div>
        <div>
          <span className="label">Isi halaman</span>
          <RichTextEditor name="contentHtml" initialHtml={values.contentHtml} />
        </div>
      </div>
      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="slug" className="label">Alamat (slug) — kosongkan untuk otomatis</label>
          <input id="slug" name="slug" maxLength={80} defaultValue={values.slug} className="input font-mono text-xs" />
        </div>
        <div>
          <label htmlFor="position" className="label">Urutan di menu Profil</label>
          <input id="position" name="position" type="number" min={0} max={999} defaultValue={values.position} className="input" />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={values.isPublished} /> Tampilkan di website
        </label>
      </div>
    </ActionForm>
  );
}
