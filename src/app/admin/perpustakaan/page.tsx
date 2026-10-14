import type { Metadata } from "next";
import Link from "next/link";
import { PublishedBadge } from "@/components/cms/image-field";
import { requireLibraryManager } from "@/lib/auth/dal";
import { VISIBILITY_LABEL } from "@/lib/school/labels";
import { LibraryForm } from "./library-form";

export const metadata: Metadata = { title: "Perpustakaan Digital" };

export default async function AdminPerpustakaanPage() {
  const ctx = await requireLibraryManager("/admin/perpustakaan");
  const { data } = await ctx.supabase
    .from("library_items")
    .select("id, title, author, category, kind, visibility, is_published")
    .order("category")
    .order("title")
    .limit(500);
  const rows = (data ?? []) as { id: string; title: string; author: string | null; category: string; kind: "tautan" | "pdf"; visibility: "public" | "internal"; is_published: boolean }[];
  const categories = [...new Set(rows.map((r) => r.category))];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Perpustakaan Digital</h1>
        <p className="text-sm text-slate-600">
          Utamakan tautan ke sumber resmi (mis. Portal Buku Kemendikdasmen). Unggah PDF hanya untuk karya milik sekolah atau yang sudah berizin.
        </p>
      </div>
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Tambah koleksi</h2>
        <LibraryForm categories={categories} />
      </section>
      <section className="card">
        <h2 className="font-semibold text-navy-900">Koleksi ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Belum ada koleksi.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-3">Judul</th><th className="py-2 pr-3">Kategori</th><th className="py-2 pr-3">Jenis</th><th className="py-2 pr-3">Akses</th><th className="py-2">Tampil</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/perpustakaan/${r.id}`} className="font-medium text-navy-900 hover:underline">{r.title}</Link>
                      {r.author && <p className="text-xs text-slate-500">{r.author}</p>}
                    </td>
                    <td className="py-2 pr-3">{r.category}</td>
                    <td className="py-2 pr-3">{r.kind === "pdf" ? "PDF" : "Tautan"}</td>
                    <td className="py-2 pr-3">{VISIBILITY_LABEL[r.visibility]}</td>
                    <td className="py-2"><PublishedBadge published={r.is_published} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
