import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireLibraryManager } from "@/lib/auth/dal";
import { deleteLibraryItemAction } from "../../sekolah/actions";
import { LibraryForm, type LibraryValues } from "../library-form";

export const metadata: Metadata = { title: "Ubah Koleksi" };

export default async function UbahKoleksiPage({ params, searchParams }: PageProps<"/admin/perpustakaan/[id]">) {
  const { id } = await params;
  const ctx = await requireLibraryManager(`/admin/perpustakaan/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data: row }, { data: cats }] = await Promise.all([
    ctx.supabase
      .from("library_items")
      .select("id, title, author, category, description, kind, url, file_path, cover_image_url, visibility, is_published, rights_confirmed_at")
      .eq("id", id)
      .maybeSingle<LibraryValues>(),
    ctx.supabase.from("library_items").select("category").limit(500),
  ]);
  if (!row) notFound();
  const categories = [...new Set(((cats ?? []) as { category: string }[]).map((c) => c.category))];
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/perpustakaan" className="text-sm text-teal-700 hover:underline">← Perpustakaan</Link>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">Ubah koleksi</h1>
      </div>
      {sp.disimpan === "1" && <Alert tone="success">Koleksi disimpan.</Alert>}
      <section className="card">
        <LibraryForm values={row} categories={categories} />
      </section>
      <section className="card">
        <h2 className="font-semibold text-red-800">Hapus koleksi</h2>
        <ActionForm action={deleteLibraryItemAction} submitLabel="Hapus koleksi" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin (file PDF ikut dihapus)</label>
        </ActionForm>
      </section>
    </div>
  );
}
