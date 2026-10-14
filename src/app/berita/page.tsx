import type { Metadata } from "next";
import Link from "next/link";
import { FeaturedNewsCard, NewsCard } from "@/components/news-card";
import { SubscribeForm } from "@/components/subscribe-form";
import { listPublicNews } from "@/lib/news";
import { newsLastPage, newsPageWindow, normalizeSearch, pageHref, parsePage } from "@/lib/news-utils";

export const metadata: Metadata = {
  title: "Berita",
  description: "Berita dan informasi terbaru sekolah.",
};

const PAGE_SIZE = 9;

export default async function BeritaPage({ searchParams }: PageProps<"/berita">) {
  const sp = await searchParams;
  const q = normalizeSearch(sp.q);
  const page = parsePage(sp.halaman);
  const win = newsPageWindow(page, Boolean(q), PAGE_SIZE);
  const { items, total } = await listPublicNews(win.limit, win.offset, q);
  const featured = win.withFeatured ? items[0] ?? null : null;
  const rest = win.withFeatured ? items.slice(1) : items;
  const lastPage = newsLastPage(total, Boolean(q), PAGE_SIZE);

  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="eyebrow">Portal berita</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">Berita sekolah</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Kabar kegiatan dan informasi resmi sekolah. Dapat dibaca siapa saja tanpa perlu masuk.</p>
          <form method="get" role="search" className="mt-6 flex max-w-xl gap-2">
            <label htmlFor="q" className="sr-only">Cari berita</label>
            <input id="q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Cari judul atau ringkasan berita…" className="input !py-2.5" />
            <button type="submit" className="btn-primary shrink-0">Cari</button>
          </form>
          {q && (
            <p className="mt-3 text-sm text-slate-600">
              {total} hasil untuk “<strong>{q}</strong>”.{" "}
              <Link href="/berita" className="font-semibold text-teal-700 hover:underline">Hapus pencarian</Link>
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {featured && <div className="mb-10"><FeaturedNewsCard news={featured} /></div>}

        {rest.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((n) => <NewsCard key={n.id} news={n} />)}
          </div>
        ) : (
          !featured && (
            <div className="card text-center">
              <p className="font-semibold text-navy-900">{q ? "Tidak ada berita yang cocok." : "Belum ada berita yang diterbitkan."}</p>
              {q && <p className="mt-1 text-sm text-slate-500">Coba kata kunci lain.</p>}
            </div>
          )
        )}

        {lastPage > 1 && (
          <nav aria-label="Halaman berita" className="mt-10 flex items-center justify-center gap-3 text-sm">
            {page > 1 ? (
              <Link href={pageHref("/berita", { q, halaman: page - 1 })} className="btn-secondary">← Sebelumnya</Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-40" aria-hidden>← Sebelumnya</span>
            )}
            <span className="text-slate-600">Halaman {page} dari {lastPage}</span>
            {page < lastPage ? (
              <Link href={pageHref("/berita", { q, halaman: page + 1 })} className="btn-secondary">Berikutnya →</Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-40" aria-hidden>Berikutnya →</span>
            )}
          </nav>
        )}

        <div className="mx-auto mt-16 max-w-3xl">
          <SubscribeForm source="halaman_berita" />
        </div>
      </div>
    </div>
  );
}
