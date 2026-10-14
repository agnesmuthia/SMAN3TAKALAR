import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { legacyTextToHtml } from "@/lib/cms/sanitize";
import { deletePageAction } from "../../konten/actions";
import { PageForm } from "../page-form";

export const metadata: Metadata = { title: "Ubah Halaman" };

export default async function UbahHalamanPage({ params, searchParams }: PageProps<"/admin/halaman/[id]">) {
  const { id } = await params;
  const ctx = await requireNewsPublisher(`/admin/halaman/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: page } = await ctx.supabase
    .from("site_pages")
    .select("id, slug, title, summary, content, content_html, position, is_published")
    .eq("id", id)
    .maybeSingle<{ id: string; slug: string; title: string; summary: string; content: string; content_html: string | null; position: number; is_published: boolean }>();
  if (!page) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/halaman" className="text-sm text-teal-700 hover:underline">← Halaman</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Ubah Halaman</h1>
        </div>
        {page.is_published && <Link href={`/profil/${page.slug}`} target="_blank" className="btn-secondary">Lihat di website ↗</Link>}
      </div>
      {sp.disimpan === "1" && <Alert tone="success">Halaman disimpan.</Alert>}
      <PageForm
        values={{
          id: page.id,
          title: page.title,
          slug: page.slug,
          summary: page.summary,
          contentHtml: page.content_html ?? legacyTextToHtml(page.content),
          position: page.position,
          isPublished: page.is_published,
        }}
      />
      <section className="card">
        <h2 className="font-semibold text-red-800">Hapus halaman</h2>
        <p className="mt-1 text-sm text-slate-600">Untuk menyembunyikan sementara, hapus centang &quot;Tampilkan di website&quot;.</p>
        <ActionForm action={deletePageAction} submitLabel="Hapus halaman" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={page.id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin</label>
        </ActionForm>
      </section>
    </div>
  );
}
