import { ActionForm } from "@/components/action-form";
import { ImageField } from "@/components/cms/image-field";
import { saveLibraryItemAction } from "../sekolah/actions";

export type LibraryValues = {
  id: string;
  title: string;
  author: string | null;
  category: string;
  description: string;
  kind: "tautan" | "pdf";
  url: string | null;
  file_path: string | null;
  cover_image_url: string | null;
  visibility: "public" | "internal";
  is_published: boolean;
  rights_confirmed_at: string | null;
};

export function LibraryForm({ values, categories }: { values?: LibraryValues; categories: string[] }) {
  const v = values;
  return (
    <ActionForm action={saveLibraryItemAction} submitLabel={v ? "Simpan perubahan" : "Tambah koleksi"} pendingLabel="Menyimpan…" submitClassName="btn-primary">
      {v && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="l-title">Judul</label>
            <input id="l-title" name="title" required minLength={3} maxLength={200} defaultValue={v?.title} className="input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="l-author">Penulis/penerbit (opsional)</label>
              <input id="l-author" name="author" maxLength={200} defaultValue={v?.author ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="l-cat">Kategori</label>
              <input id="l-cat" name="category" required maxLength={60} list="kategori-perpustakaan" defaultValue={v?.category ?? ""} className="input" placeholder="mis. Buku Teks, Modul, Referensi" />
              <datalist id="kategori-perpustakaan">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="l-desc">Deskripsi singkat (opsional)</label>
            <textarea id="l-desc" name="description" rows={3} maxLength={1000} defaultValue={v?.description} className="input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="l-vis">Dapat dilihat oleh</label>
              <select id="l-vis" name="visibility" defaultValue={v?.visibility ?? "public"} className="input">
                <option value="public">Publik</option>
                <option value="internal">Internal (guru &amp; siswa terverifikasi)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="isPublished" defaultChecked={v?.is_published ?? false} /> Tampilkan di perpustakaan
            </label>
          </div>
        </div>
        <div className="space-y-3">
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-sm font-semibold text-navy-900">Sumber</legend>
            <div>
              <label className="label" htmlFor="l-kind">Jenis</label>
              <select id="l-kind" name="kind" defaultValue={v?.kind ?? "tautan"} className="input">
                <option value="tautan">Tautan ke situs resmi (disarankan)</option>
                <option value="pdf">PDF milik sekolah</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="l-url">Tautan (untuk jenis Tautan)</label>
              <input id="l-url" name="url" type="url" maxLength={1000} defaultValue={v?.url ?? ""} placeholder="https://" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="l-file">{v?.file_path ? "Ganti PDF (opsional)" : "File PDF (untuk jenis PDF)"}</label>
              <input
                id="l-file"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {v?.file_path && <p className="mt-1 text-xs text-slate-500">PDF tersimpan. <a href={`/perpustakaan/${v.id}/buka`} target="_blank" rel="noopener" className="text-teal-700 hover:underline">Buka ↗</a></p>}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="rights" defaultChecked={Boolean(v?.rights_confirmed_at)} className="mt-1" />
              <span>Untuk PDF: sekolah memiliki hak atau izin membagikan file ini (bukan salinan buku berhak cipta tanpa izin).</span>
            </label>
          </fieldset>
          <ImageField label="Sampul (opsional)" current={v?.cover_image_url ?? null} />
        </div>
      </div>
    </ActionForm>
  );
}
