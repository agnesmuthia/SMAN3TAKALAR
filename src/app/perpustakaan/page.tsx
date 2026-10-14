import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Pager } from "@/components/pager";
import { listLibraryCategories, listLibraryItems } from "@/lib/school/public";
import { normalizeSearch, pageHref, parsePage } from "@/lib/news-utils";
import { PORTAL_BUKU_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Perpustakaan Digital", description: "Koleksi bacaan digital dan tautan buku resmi." };

const PAGE_SIZE = 24;

export default async function PerpustakaanPage({ searchParams }: PageProps<"/perpustakaan">) {
  const sp = await searchParams;
  const q = normalizeSearch(sp.q);
  const page = parsePage(sp.halaman);
  const categories = await listLibraryCategories();
  const category = categories.find((c) => c === sp.kategori);
  const { items, total } = await listLibraryItems({ q, category }, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || category);

  return (
    <div>
      <PageHero eyebrow="Literasi" title="Perpustakaan digital" description="Bacaan dan bahan belajar yang dapat diakses siswa, guru, dan masyarakat.">
        <form method="get" role="search" className="mt-6 flex max-w-xl gap-2">
          {category && <input type="hidden" name="kategori" value={category} />}
          <label htmlFor="q" className="sr-only">Cari koleksi</label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Cari judul, penulis, atau topik…" className="input !py-2.5" />
          <button type="submit" className="btn-primary shrink-0">Cari</button>
        </form>
        {categories.length > 0 && (
          <nav aria-label="Kategori koleksi" className="mt-5 flex flex-wrap gap-2">
            <Link href={pageHref("/perpustakaan", { q })} aria-current={!category ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${!category ? "bg-navy-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700"}`}>
              Semua
            </Link>
            {categories.map((c) => (
              <Link key={c} href={pageHref("/perpustakaan", { q, kategori: c })} aria-current={category === c ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${category === c ? "bg-navy-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:border-teal-600 hover:text-teal-700"}`}>
                {c}
              </Link>
            ))}
          </nav>
        )}
      </PageHero>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12">
        <a href={PORTAL_BUKU_URL} target="_blank" rel="noopener noreferrer" className="group card card-hover relative block overflow-hidden !p-8">
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-50" />
          <p className="eyebrow relative">Sumber resmi pemerintah</p>
          <h2 className="relative mt-2 text-xl font-bold text-navy-900">Portal Buku Kemendikdasmen</h2>
          <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Buku teks dan bacaan resmi dari Kementerian Pendidikan Dasar dan Menengah, gratis untuk dibaca. Tautan membuka situs resmi di tab baru.
          </p>
          <span className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">Buka portal <span aria-hidden>↗</span></span>
        </a>

        <section aria-labelledby="judul-koleksi">
          <h2 id="judul-koleksi" className="section-title">{category ?? "Koleksi sekolah"}</h2>
          {items.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={filtered ? "Tidak ada koleksi yang cocok." : "Koleksi sekolah belum tersedia."}
                text={filtered ? "Coba kata kunci atau kategori lain." : "Sementara itu, gunakan Portal Buku Kemendikdasmen di atas."}
              />
            </div>
          ) : (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const href = item.kind === "tautan" && item.url ? item.url : `/perpustakaan/${item.id}/buka`;
                return (
                  <li key={item.id} className="card flex flex-col overflow-hidden !p-0">
                    {item.cover_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.cover_image_url} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold text-teal-800">{item.category}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{item.kind === "pdf" ? "PDF" : "Tautan"}</span>
                        {item.visibility === "internal" && <span className="rounded-full bg-navy-900 px-2 py-0.5 font-semibold text-white">Internal</span>}
                      </div>
                      <h3 className="mt-2 font-bold leading-snug text-navy-900">{item.title}</h3>
                      {item.author && <p className="text-sm text-slate-600">{item.author}</p>}
                      {item.description && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{item.description}</p>}
                      <a href={href} target="_blank" rel="noopener noreferrer" className="mt-auto pt-4 text-sm font-semibold text-teal-700 hover:underline">
                        {item.kind === "pdf" ? "Baca PDF" : "Buka tautan"} <span aria-hidden>↗</span>
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager base="/perpustakaan" params={{ q, kategori: category ?? "" }} page={page} lastPage={lastPage} />
        </section>
      </div>
    </div>
  );
}
