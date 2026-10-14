import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireRole } from "@/lib/auth/dal";
import { deleteNewsAction } from "../../actions";
import { NewsForm, type NewsFormValues } from "../news-form";

export const metadata: Metadata = { title: "Ubah berita" };

export default async function UbahBeritaPage({ params, searchParams }: PageProps<"/admin/berita/[id]">) {
  const { id } = await params;
  const ctx = await requireRole(["admin"], `/admin/berita/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data } = await ctx.supabase
    .from("news")
    .select("id, title, slug, excerpt, content, cover_image_url, status, visibility, newsletter_eligible")
    .eq("id", id)
    .maybeSingle<NewsFormValues>();
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand-900">Ubah berita</h1>
          {data.status === "published" && data.visibility === "public" && (
            <Link href={`/berita/${data.slug}`} className="text-sm text-brand-700 hover:underline">Lihat halaman publik</Link>
          )}
        </div>
        {sp.disimpan === "1" && <Alert tone="success">Berita disimpan.</Alert>}
        <NewsForm values={data} />
      </div>
      <div className="card">
        <h2 className="font-semibold">Hapus berita</h2>
        <p className="mt-1 text-sm text-slate-600">Berita yang sudah dipakai dalam kampanye tidak dapat dihapus; arsipkan saja.</p>
        <ActionForm action={deleteNewsAction} submitLabel="Hapus permanen" className="mt-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={data.id} />
        </ActionForm>
      </div>
    </div>
  );
}
