import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export const metadata: Metadata = { title: "Kategori Berita" };

export default async function KategoriPage() {
  const ctx = await requireNewsPublisher("/admin/berita/kategori");
  const { data } = await ctx.supabase.from("news_categories").select("id, name, slug, description, position").order("position");
  const rows = (data ?? []) as { id: string; name: string; slug: string; description: string | null; position: number }[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/berita" className="text-sm text-teal-700 hover:underline">← Manajemen Berita</Link>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">Kategori Berita</h1>
        <p className="text-sm text-slate-600">Kategori tampil sebagai filter di halaman berita publik. Menghapus kategori tidak menghapus beritanya.</p>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold text-navy-900">Tambah kategori</h2>
        <ActionForm action={saveCategoryAction} submitLabel="Tambah" className="grid gap-3 sm:grid-cols-[1fr_2fr_6rem_auto] sm:items-end" submitClassName="btn-primary">
          <div><label className="label" htmlFor="new-name">Nama</label><input id="new-name" name="name" required minLength={2} maxLength={60} className="input" /></div>
          <div><label className="label" htmlFor="new-desc">Deskripsi (opsional)</label><input id="new-desc" name="description" maxLength={300} className="input" /></div>
          <div><label className="label" htmlFor="new-pos">Urutan</label><input id="new-pos" name="position" type="number" min={0} max={999} defaultValue={rows.length + 1} className="input" /></div>
        </ActionForm>
      </section>

      <ul className="space-y-3">
        {rows.map((c) => (
          <li key={c.id} className="card !p-4">
            <ActionForm action={saveCategoryAction} submitLabel="Simpan" className="grid gap-3 sm:grid-cols-[1fr_2fr_6rem_auto] sm:items-end" submitClassName="btn-secondary">
              <input type="hidden" name="id" value={c.id} />
              <div><label className="label" htmlFor={`n-${c.id}`}>Nama</label><input id={`n-${c.id}`} name="name" defaultValue={c.name} required minLength={2} maxLength={60} className="input" /></div>
              <div><label className="label" htmlFor={`d-${c.id}`}>Deskripsi</label><input id={`d-${c.id}`} name="description" defaultValue={c.description ?? ""} maxLength={300} className="input" /></div>
              <div><label className="label" htmlFor={`p-${c.id}`}>Urutan</label><input id={`p-${c.id}`} name="position" type="number" min={0} max={999} defaultValue={c.position} className="input" /></div>
            </ActionForm>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Alamat: /berita?kategori={c.slug}</span>
              <ActionForm action={deleteCategoryAction} submitLabel="Hapus kategori" className="" submitClassName="font-semibold text-red-700 hover:underline">
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
