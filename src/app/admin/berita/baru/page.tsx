import type { Metadata } from "next";
import Link from "next/link";
import { NewsEditorForm } from "@/components/cms/news-editor-form";
import { requireNewsWriter } from "@/lib/auth/dal";
import { allowedIntents } from "@/lib/cms/workflow";

export const metadata: Metadata = { title: "Tambah Berita" };

export default async function BeritaBaruPage() {
  const ctx = await requireNewsWriter("/admin/berita/baru");
  const { data: cats } = await ctx.supabase.from("news_categories").select("id, name").order("position");
  return (
    <div className="space-y-4">
      <Link href="/admin/berita" className="text-sm text-teal-700 hover:underline">← Manajemen Berita</Link>
      <h1 className="text-2xl font-bold text-navy-900">Tambah Berita</h1>
      <NewsEditorForm
        values={{
          title: "",
          slug: "",
          excerpt: "",
          contentHtml: "",
          coverImageUrl: null,
          categoryId: null,
          tags: "",
          visibility: "public",
          newsletterEligible: true,
          publishAtLocal: "",
        }}
        categories={(cats ?? []) as { id: string; name: string }[]}
        intents={allowedIntents(ctx.access, null, true)}
        canPublish={ctx.access.canPublish}
        isPublished={false}
      />
    </div>
  );
}
