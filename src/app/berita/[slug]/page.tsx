import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsCard } from "@/components/news-card";
import { SubscribeForm } from "@/components/subscribe-form";
import { getPublicNewsBySlug, listRelatedNews } from "@/lib/news";
import { paragraphs, readingMinutes } from "@/lib/news-utils";
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
  const related = await listRelatedNews(news.id, 3);

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
          <div className="prose-berita">
            {paragraphs(news.content).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>

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
