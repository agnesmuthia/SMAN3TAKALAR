import Link from "next/link";
import { CompactNewsItem, FeaturedNewsCard } from "@/components/news-card";
import { SchoolMark } from "@/components/school-mark";
import { SubscribeForm } from "@/components/subscribe-form";
import { listPublicNews } from "@/lib/news";
import { PORTAL_BUKU_URL, siteConfig } from "@/lib/site";

// Beranda hanya menampilkan bagian yang datanya benar-benar tersedia. Bagian
// program, prestasi, galeri, kalender, dan Ruang Rasa ditambahkan saat modulnya
// dibangun (lihat docs/AUDIT_DAN_RENCANA.md), bukan diisi data contoh.
export default async function HomePage() {
  const { items } = await listPublicNews(5);
  const [featured, ...latest] = items;

  return (
    <>
      <section className="hero-pattern relative overflow-hidden text-white">
        <div aria-hidden className="hero-grid absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:py-24 lg:grid-cols-12">
          <div className="animate-fade-up lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Website resmi sekolah</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {siteConfig.name}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">
              Kabar kegiatan, prestasi, dan informasi sekolah untuk siswa, orang tua, dan masyarakat.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/berita" className="btn-gold">Baca berita terbaru</Link>
              <Link href="/masuk" className="btn-ghost-light">Masuk warga sekolah</Link>
            </div>
          </div>
          <div aria-hidden className="hidden justify-center lg:col-span-4 lg:flex">
            <div className="rounded-3xl bg-white/5 p-10 ring-1 ring-white/10 backdrop-blur">
              <SchoolMark size={140} tone="light" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="judul-berita">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Kabar sekolah</p>
            <h2 id="judul-berita" className="section-title mt-1">Berita terbaru</h2>
          </div>
          <Link href="/berita" className="text-sm font-semibold text-teal-700 hover:underline">
            Semua berita <span aria-hidden>→</span>
          </Link>
        </div>

        {featured ? (
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <FeaturedNewsCard news={featured} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-2 shadow-sm">
              {latest.length ? (
                latest.map((n) => <CompactNewsItem key={n.id} news={n} />)
              ) : (
                <p className="py-6 text-sm text-slate-500">Berita lainnya akan tampil di sini.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card mt-8 text-center">
            <p className="font-semibold text-navy-900">Belum ada berita yang diterbitkan.</p>
            <p className="mt-1 text-sm text-slate-500">Berita yang diterbitkan admin akan langsung tampil di sini.</p>
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2" aria-label="Layanan">
        <a
          href={PORTAL_BUKU_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group card card-hover relative overflow-hidden !p-8"
        >
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-50" />
          <p className="eyebrow relative">Perpustakaan digital</p>
          <h2 className="relative mt-2 text-xl font-bold text-navy-900">Portal Buku Kemendikdasmen</h2>
          <p className="relative mt-2 text-sm leading-relaxed text-slate-600">
            Akses buku teks dan bacaan resmi dari Kementerian Pendidikan Dasar dan Menengah. Tautan membuka situs
            resmi di tab baru.
          </p>
          <span className="relative mt-5 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
            Buka portal <span aria-hidden className="transition group-hover:translate-x-0.5">↗</span>
          </span>
        </a>
        <SubscribeForm source="beranda" />
      </section>
    </>
  );
}
