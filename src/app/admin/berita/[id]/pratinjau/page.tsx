import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { requireNewsWriter } from "@/lib/auth/dal";
import { DISPLAY_STATUS_LABEL, displayStatus } from "@/lib/cms/workflow";
import { readingMinutes } from "@/lib/news-utils";
import { formatTanggal } from "@/lib/site";

export const metadata: Metadata = { title: "Pratinjau Berita", robots: { index: false } };

export default async function PratinjauPage({ params }: PageProps<"/admin/berita/[id]/pratinjau">) {
  const { id } = await params;
  const ctx = await requireNewsWriter(`/admin/berita/${id}/pratinjau`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: news } = await ctx.supabase
    .from("news")
    .select("title, excerpt, content, content_html, cover_image_url, status, published_at, category:category_id (name)")
    .eq("id", id)
    .maybeSingle<{ title: string; excerpt: string; content: string; content_html: string | null; cover_image_url: string | null; status: string; published_at: string | null; category: { name: string } | null }>();
  if (!news) notFound();

  return (
    <article className="-mx-4 -my-8 bg-surface">
      <div className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
        PRATINJAU · Status: {DISPLAY_STATUS_LABEL[displayStatus(news.status, news.published_at)]} · Halaman ini hanya terlihat oleh tim CMS
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
          {news.category && <p className="eyebrow">{news.category.name}</p>}
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">{news.title}</h1>
          <p className="mt-4 text-sm text-slate-500">
            {news.published_at ? formatTanggal(news.published_at) : "Belum dijadwalkan"} • {readingMinutes(news.excerpt, news.content)} menit baca
          </p>
          {news.excerpt && <p className="mt-5 text-lg leading-relaxed text-slate-700">{news.excerpt}</p>}
        </div>
      </header>
      {news.cover_image_url && (
        <div className="mx-auto max-w-5xl px-4 pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={news.cover_image_url} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />
        </div>
      )}
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ArticleBody html={news.content_html} text={news.content} />
      </div>
    </article>
  );
}
