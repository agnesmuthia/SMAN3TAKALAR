import Link from "next/link";
import type { PublicNews } from "@/lib/news";
import { readingMinutes } from "@/lib/news-utils";
import { formatTanggal } from "@/lib/site";

function Cover({ news, className }: { news: PublicNews; className: string }) {
  return news.cover_image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={news.cover_image_url} alt="" loading="lazy" className={`${className} object-cover transition duration-500 group-hover:scale-[1.03]`} />
  ) : (
    // Tanpa gambar: bidang warna netral, bukan foto pengganti.
    <div aria-hidden className={`${className} hero-pattern`} />
  );
}

function Meta({ news, compact = false }: { news: PublicNews; compact?: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
      <time dateTime={news.published_at}>{formatTanggal(news.published_at)}</time>
      {!compact && (
        <>
          <span aria-hidden>•</span>
          <span>{readingMinutes(news.excerpt, news.content)} menit baca</span>
        </>
      )}
    </p>
  );
}

export function NewsCard({ news }: { news: PublicNews }) {
  return (
    <article className="group card-hover flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {news.cover_image_url ? (
        <Link href={`/berita/${news.slug}`} tabIndex={-1} aria-hidden className="block overflow-hidden">
          <Cover news={news} className="aspect-[16/10] w-full" />
        </Link>
      ) : (
        <div aria-hidden className="h-1.5 bg-gradient-to-r from-navy-900 via-teal-600 to-gold-500" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <Meta news={news} />
        <h3 className="mt-2 text-lg font-bold leading-snug text-navy-900">
          <Link href={`/berita/${news.slug}`} className="hover:text-teal-700">{news.title}</Link>
        </h3>
        {news.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{news.excerpt}</p>}
        <Link href={`/berita/${news.slug}`} className="mt-auto pt-4 text-sm font-semibold text-teal-700 hover:underline">
          Baca selengkapnya <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

export function FeaturedNewsCard({ news }: { news: PublicNews }) {
  return (
    <article
      className={`group grid h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
        news.cover_image_url ? "lg:grid-cols-5" : "border-l-4 border-l-gold-500"
      }`}
    >
      {news.cover_image_url && (
        <Link href={`/berita/${news.slug}`} tabIndex={-1} aria-hidden className="block overflow-hidden lg:col-span-3">
          <Cover news={news} className="aspect-[16/9] h-full w-full lg:aspect-auto lg:min-h-80" />
        </Link>
      )}
      <div className={`flex flex-col justify-center p-6 sm:p-10 ${news.cover_image_url ? "lg:col-span-2" : ""}`}>
        <span className="mb-3 inline-flex w-fit items-center rounded-full bg-gold-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy-900">
          Berita utama
        </span>
        <Meta news={news} />
        <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-navy-900 sm:text-3xl">
          <Link href={`/berita/${news.slug}`} className="hover:text-teal-700">{news.title}</Link>
        </h2>
        {news.excerpt && <p className="mt-3 line-clamp-4 leading-relaxed text-slate-600">{news.excerpt}</p>}
        <Link href={`/berita/${news.slug}`} className="btn-primary mt-6 w-fit">
          Baca berita <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

export function CompactNewsItem({ news }: { news: PublicNews }) {
  return (
    <article className="group flex gap-4 border-b border-slate-100 py-4 last:border-0">
      <Link href={`/berita/${news.slug}`} tabIndex={-1} aria-hidden className="block shrink-0 overflow-hidden rounded-lg">
        <Cover news={news} className="h-20 w-28" />
      </Link>
      <div className="min-w-0">
        <Meta news={news} compact />
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug text-navy-900">
          <Link href={`/berita/${news.slug}`} className="hover:text-teal-700">{news.title}</Link>
        </h3>
      </div>
    </article>
  );
}
