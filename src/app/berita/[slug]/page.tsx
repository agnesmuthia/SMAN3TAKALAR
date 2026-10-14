import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubscribeForm } from "@/components/subscribe-form";
import { getPublicNewsBySlug } from "@/lib/news";
import { formatTanggal } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/berita/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const news = await getPublicNewsBySlug(slug);
  if (!news) return { title: "Berita tidak ditemukan" };
  return { title: news.title, description: news.excerpt || undefined };
}

export default async function BeritaDetailPage({ params }: PageProps<"/berita/[slug]">) {
  const { slug } = await params;
  const news = await getPublicNewsBySlug(slug);
  if (!news) notFound();

  const paragraphs = news.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/berita" className="text-sm font-semibold text-brand-700 hover:underline">← Semua berita</Link>
      <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-900">{news.title}</h1>
      <time dateTime={news.published_at} className="mt-2 block text-sm text-slate-500">
        {formatTanggal(news.published_at)}
      </time>
      {news.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={news.cover_image_url} alt="" className="mt-6 w-full rounded-lg object-cover" />
      )}
      {news.excerpt && <p className="mt-6 text-lg text-slate-700">{news.excerpt}</p>}
      <div className="prose-berita mt-6 text-slate-800">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
      </div>

      <div className="mt-12">
        <SubscribeForm source="artikel" />
      </div>
    </article>
  );
}
