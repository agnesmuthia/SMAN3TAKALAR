import Link from "next/link";
import type { PublicNews } from "@/lib/news";
import { formatTanggal } from "@/lib/site";

export function NewsCard({ news }: { news: PublicNews }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {news.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={news.cover_image_url} alt="" className="aspect-video w-full object-cover" loading="lazy" />
      ) : (
        <div aria-hidden className="aspect-video w-full bg-gradient-to-br from-brand-700 to-brand-900" />
      )}
      <div className="flex flex-1 flex-col p-5">
        <time dateTime={news.published_at} className="text-xs text-slate-500">
          {formatTanggal(news.published_at)}
        </time>
        <h3 className="mt-1 text-lg font-semibold leading-snug text-slate-900">
          <Link href={`/berita/${news.slug}`} className="hover:text-brand-700">
            {news.title}
          </Link>
        </h3>
        {news.excerpt && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{news.excerpt}</p>}
        <Link href={`/berita/${news.slug}`} className="mt-auto pt-4 text-sm font-semibold text-brand-700 hover:underline">
          Baca berita selengkapnya →
        </Link>
      </div>
    </article>
  );
}
