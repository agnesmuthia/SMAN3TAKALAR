import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { SubscribeForm } from "@/components/subscribe-form";
import { listPublicNews } from "@/lib/news";
import { siteConfig } from "@/lib/site";

export default async function HomePage() {
  const { items } = await listPublicNews(3);

  return (
    <>
      <section className="bg-brand-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-400">Website Resmi</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">{siteConfig.name}</h1>
          <p className="mt-4 max-w-2xl text-slate-200">
            Informasi kegiatan, prestasi, dan pengumuman sekolah untuk siswa, orang tua, dan masyarakat.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/berita" className="btn-secondary">Lihat berita</Link>
            <Link href="/masuk" className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">
              Masuk warga sekolah
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold text-brand-900">Berita Terbaru</h2>
          <Link href="/berita" className="text-sm font-semibold text-brand-700 hover:underline">Semua berita</Link>
        </div>
        {items.length ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((n) => <NewsCard key={n.id} news={n} />)}
          </div>
        ) : (
          <p className="mt-6 text-slate-600">Belum ada berita yang diterbitkan.</p>
        )}
      </section>

      <section className="mx-auto max-w-3xl px-4">
        <SubscribeForm source="beranda" />
      </section>
    </>
  );
}
