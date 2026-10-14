"use client";

import { useActionState } from "react";
import type { ActionFormState } from "@/components/action-form";
import { saveNewsAction } from "@/app/admin/berita/actions";
import type { NewsIntent } from "@/lib/cms/workflow";
import { RichTextEditor } from "./rich-text-editor";

export type NewsEditorValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl: string | null;
  categoryId: string | null;
  tags: string;
  visibility: "public" | "internal";
  newsletterEligible: boolean;
  publishAtLocal: string; // "YYYY-MM-DDTHH:MM" (WITA) atau ""
};

const INTENT_BUTTON: Record<NewsIntent, { label: string; className: string; confirm?: string }> = {
  save: { label: "Simpan", className: "btn-secondary" },
  submit: { label: "Kirim untuk persetujuan", className: "btn-primary" },
  publish: { label: "Terbitkan / jadwalkan", className: "btn-gold" },
  return: { label: "Kembalikan ke penulis", className: "btn-secondary" },
  archive: { label: "Arsipkan", className: "btn-danger", confirm: "Arsipkan berita ini? Berita tidak akan tampil lagi di website." },
  restore: { label: "Pulihkan sebagai draf", className: "btn-primary" },
};

export function NewsEditorForm({
  values,
  categories,
  intents,
  canPublish,
  isPublished,
}: {
  values: NewsEditorValues;
  categories: { id: string; name: string }[];
  intents: NewsIntent[];
  canPublish: boolean;
  isPublished: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(saveNewsAction, { status: "idle", message: "" });
  const readOnly = intents.length === 0 || (intents.length === 1 && intents[0] === "restore");
  const showSchedule = canPublish && (intents.includes("publish") || isPublished);

  return (
    <form action={formAction} className="space-y-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="coverImageUrl" value={values.coverImageUrl ?? ""} />

      <fieldset disabled={readOnly || pending} className="space-y-6">
        <div className="card space-y-4">
          <div>
            <label htmlFor="title" className="label">Judul berita</label>
            <input id="title" name="title" required minLength={3} maxLength={200} defaultValue={values.title} className="input !text-lg !font-semibold" />
          </div>
          <div>
            <label htmlFor="excerpt" className="label">Ringkasan (tampil di daftar berita dan email, maks. 400 karakter)</label>
            <textarea id="excerpt" name="excerpt" rows={3} maxLength={400} defaultValue={values.excerpt} className="input" />
          </div>
          <div>
            <span className="label">Isi berita</span>
            <RichTextEditor name="contentHtml" initialHtml={values.contentHtml} />
            <p className="mt-1 text-xs text-slate-500">
              Gunakan &quot;Judul&quot;/&quot;Subjudul&quot; untuk bagian artikel. Gambar di dalam isi otomatis diunggah ke penyimpanan sekolah.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-4">
            <h2 className="font-semibold text-navy-900">Gambar utama</h2>
            {values.coverImageUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={values.coverImageUrl} alt="Gambar utama saat ini" className="aspect-[16/9] w-full rounded-lg object-cover" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removeCover" /> Hapus gambar utama
                </label>
              </>
            )}
            <div>
              <label htmlFor="coverFile" className="label">{values.coverImageUrl ? "Ganti gambar" : "Unggah gambar"} (JPG, PNG, WebP, maks. 5 MB)</label>
              <input id="coverFile" name="coverFile" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
              <p className="mt-1 text-xs text-slate-500">Pastikan foto boleh dipublikasikan dan tidak menampilkan data pribadi siswa.</p>
            </div>
          </div>

          <div className="card space-y-4">
            <h2 className="font-semibold text-navy-900">Pengaturan</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="categoryId" className="label">Kategori</label>
                <select id="categoryId" name="categoryId" defaultValue={values.categoryId ?? ""} className="input">
                  <option value="">Tanpa kategori</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="visibility" className="label">Akses</label>
                <select id="visibility" name="visibility" defaultValue={values.visibility} className="input">
                  <option value="public">Publik</option>
                  <option value="internal">Internal (warga sekolah)</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="tags" className="label">Tag (pisahkan dengan koma, maks. 10)</label>
              <input id="tags" name="tags" defaultValue={values.tags} maxLength={500} placeholder="mis. lomba, sains, osis" className="input" />
            </div>
            <div>
              <label htmlFor="slug" className="label">Alamat (slug) — kosongkan untuk otomatis dari judul</label>
              <input id="slug" name="slug" defaultValue={values.slug} maxLength={120} className="input font-mono text-xs" />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="newsletterEligible" defaultChecked={values.newsletterEligible} className="mt-1" />
              <span>Boleh dimasukkan ke buletin email (hanya berlaku untuk berita publik yang terbit).</span>
            </label>
            {showSchedule && (
              <div>
                <label htmlFor="publishAt" className="label">Tanggal &amp; jam terbit (WITA)</label>
                <input id="publishAt" name="publishAt" type="datetime-local" defaultValue={values.publishAtLocal} className="input" />
                <p className="mt-1 text-xs text-slate-500">Kosongkan untuk terbit sekarang. Isi tanggal mendatang untuk menjadwalkan.</p>
              </div>
            )}
          </div>
        </div>

        {intents.includes("return") && (
          <div className="card">
            <label htmlFor="reviewNote" className="label">Catatan untuk penulis (wajib bila dikembalikan)</label>
            <textarea id="reviewNote" name="reviewNote" rows={3} maxLength={1000} className="input" />
          </div>
        )}
      </fieldset>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        {state.status !== "idle" && (
          <p role={state.status === "error" ? "alert" : "status"} className={`mb-2 text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>
            {state.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {intents.length === 0 && <p className="text-sm text-slate-600">Anda tidak dapat mengubah berita ini pada status saat ini.</p>}
          {intents.map((intent) => {
            const b = INTENT_BUTTON[intent];
            return (
              <button
                key={intent}
                type="submit"
                name="intent"
                value={intent}
                disabled={pending}
                className={b.className}
                onClick={(e) => {
                  if (b.confirm && !window.confirm(b.confirm)) e.preventDefault();
                }}
              >
                {pending ? "Memproses…" : b.label}
              </button>
            );
          })}
        </div>
      </div>
    </form>
  );
}
