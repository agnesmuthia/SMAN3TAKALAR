import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsCard } from "@/components/news-card";
import { SubscribeForm } from "@/components/subscribe-form";
import { ArticleBody } from "@/components/article-body";
import { getPublicNewsBySlug, listRelatedNews, tagsForNews } from "@/lib/news";
import { readingMinutes } from "@/lib/news-utils";
import { absoluteUrl, formatTanggal } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/berita/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const news = await getPublicNewsBySlug(slug);
  if (!news) return { title: "Berita tidak ditemukan" };
  return {
    title: news.title,
    description: news.excerpt || undefined,
    alternates: { canonical: `/berita/${news.slug}` },
    openGraph: {
      type: "article",
      title: news.title,
      description: news.excerpt || undefined,
      publishedTime: news.published_at,
      images: news.cover_image_url ? [news.cover_image_url] : undefined,
    },
  };
}

export default async function BeritaDetailPage({ params }: PageProps<"/berita/[slug]">) {
  const { slug } = await params;
  const news = await getPublicNewsBySlug(slug);
  if (!news) notFound();
  const [related, tags] = await Promise.all([listRelatedNews(news.id, news.category_id, 3), tagsForNews(news.id)]);

  const url = absoluteUrl(`/berita/${news.slug}`);
  const shareText = encodeURIComponent(`${news.title} ${url}`);
  const shareLinks = [
    { label: "WhatsApp", href: `https://wa.me/?text=${shareText}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${shareText}` },
    { label: "Email", href: `mailto:?subject=${encodeURIComponent(news.title)}&body=${encodeURIComponent(url)}` },
  ];

  return (
    <>
      <article>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
            <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li><Link href="/" className="hover:text-teal-700">Beranda</Link></li>
                <li aria-hidden>/</li>
                <li><Link href="/berita" className="hover:text-teal-700">Berita</Link></li>
                {news.category && (
                  <>
                    <li aria-hidden>/</li>
                    <li><Link href={`/berita?kategori=${news.category.slug}`} className="hover:text-teal-700">{news.category.name}</Link></li>
                  </>
                )}
              </ol>
            </nav>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl lg:text-[2.75rem]">
              {news.title}
            </h1>
            <p className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
              <time dateTime={news.published_at}>{formatTanggal(news.published_at)}</time>
              <span aria-hidden>•</span>
              <span>{readingMinutes(news.excerpt, news.content)} menit baca</span>
            </p>
            {news.excerpt && <p className="mt-5 text-lg leading-relaxed text-slate-700">{news.excerpt}</p>}
          </div>
        </header>

        {news.cover_image_url && (
          <div className="mx-auto max-w-5xl px-4 pt-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={news.cover_image_url} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover shadow-sm" />
          </div>
        )}

        <div className="mx-auto max-w-3xl px-4 py-10">
          <ArticleBody html={news.content_html ?? null} text={news.content} />

          {tags.length > 0 && (
            <ul aria-label="Tag" className="mt-8 flex flex-wrap gap-2">
              {tags.map((t) => (
                <li key={t.id}>
                  <Link href={`/berita?tag=${t.slug}`} className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800 hover:bg-teal-100">#{t.name}</Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-6 text-sm">
            <span className="mr-1 font-semibold text-navy-900">Bagikan:</span>
            {shareLinks.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 transition hover:border-teal-600 hover:text-teal-700">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-t border-slate-200 bg-white" aria-labelledby="berita-lainnya">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 id="berita-lainnya" className="section-title">Berita lainnya</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((n) => <NewsCard key={n.id} news={n} />)}
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto mt-14 max-w-3xl px-4">
        <SubscribeForm source="artikel" />
      </div>
    </>
  );
}
