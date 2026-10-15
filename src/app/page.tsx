import Link from "next/link";
import { CompactNewsItem, FeaturedNewsCard } from "@/components/news-card";
import { SchoolMark } from "@/components/school-mark";
import { SubscribeForm } from "@/components/subscribe-form";
import { EVENT_CATEGORY_LABEL, EVENT_CATEGORY_STYLE, formatEventDate, todayInZone } from "@/lib/content/calendar";
import { ACHIEVEMENT_LEVEL_LABEL } from "@/lib/content/labels";
import {
  firstPhotoByAlbum,
  listAchievements,
  listAlbums,
  listPrograms,
  listPublicAnnouncements,
  listUpcomingEvents,
} from "@/lib/content/public";
import { getSiteProfile } from "@/lib/content/site-profile";
import { listPublicNews } from "@/lib/news";
import { PORTAL_BUKU_URL, formatTanggal, formatTanggalSaja, siteConfig } from "@/lib/site";

// Beranda hanya menampilkan bagian yang datanya benar-benar tersedia (diisi
// lewat CMS). Bagian tanpa data disembunyikan, bukan diisi data contoh.
export default async function HomePage() {
  const today = todayInZone(siteConfig.timeZone);
  const [{ items }, profile, announcements, programs, achievements, events, albums] = await Promise.all([
    listPublicNews(5),
    getSiteProfile(),
    listPublicAnnouncements(3),
    listPrograms(),
    listAchievements({}, 3),
    listUpcomingEvents(today, 4),
    listAlbums(4),
  ]);
  const [featured, ...latest] = items;
  const albumFallback = await firstPhotoByAlbum(albums.items.filter((a) => !a.cover).map((a) => a.id));

  return (
    <>
      <section className="hero-pattern relative overflow-hidden text-white">
        <div aria-hidden className="hero-grid absolute inset-0" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:py-24 lg:grid-cols-12">
          <div className="animate-fade-up lg:col-span-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Website resmi sekolah</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {profile.hero_title || siteConfig.name}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-200">
              {profile.hero_subtitle || "Kabar kegiatan, prestasi, dan informasi sekolah untuk siswa, orang tua, dan masyarakat."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/berita" className="btn-gold">Baca berita terbaru</Link>
              <Link href="/masuk" className="btn-ghost-light">Masuk warga sekolah</Link>
            </div>
          </div>
          <div aria-hidden className="hidden justify-center lg:col-span-4 lg:flex">
            {profile.hero_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.hero_image_url} alt="" className="aspect-[4/5] w-full max-w-sm rounded-3xl object-cover shadow-2xl ring-1 ring-white/20" />
            ) : (
              <div className="rounded-3xl bg-white/5 p-10 ring-1 ring-white/10 backdrop-blur">
                <SchoolMark size={140} tone="light" logoUrl={profile.logo_url} />
              </div>
            )}
          </div>
        </div>
      </section>

      {announcements.items.length > 0 && (
        <section className="border-b border-slate-200 bg-gold-500/10" aria-labelledby="judul-pengumuman">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-5 md:flex-row md:items-start md:gap-6">
            <h2 id="judul-pengumuman" className="shrink-0 text-sm font-bold uppercase tracking-wider text-navy-900">Pengumuman</h2>
            <ul className="flex-1 space-y-2 text-sm">
              {announcements.items.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-3">
                  <time dateTime={a.published_at} className="text-slate-500">{formatTanggal(a.published_at)}</time>
                  <Link href={`/pengumuman#p-${a.id}`} className="font-semibold text-navy-900 hover:underline">{a.title}</Link>
                </li>
              ))}
            </ul>
            <Link href="/pengumuman" className="shrink-0 text-sm font-semibold text-teal-700 hover:underline">Semua pengumuman →</Link>
          </div>
        </section>
      )}

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

      {programs.length > 0 && (
        <section className="border-y border-slate-200 bg-white" aria-labelledby="judul-program">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="eyebrow">Keunggulan</p>
            <h2 id="judul-program" className="section-title mt-1">Program unggulan</h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p) => (
                <li key={p.id} className="card flex flex-col overflow-hidden !p-0">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-bold text-navy-900">{p.title}</h3>
                    {p.summary && <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.summary}</p>}
                    {p.page && <Link href={`/profil/${p.page.slug}`} className="mt-auto pt-3 text-sm font-semibold text-teal-700 hover:underline">Selengkapnya →</Link>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {achievements.items.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="judul-prestasi">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Kebanggaan sekolah</p>
              <h2 id="judul-prestasi" className="section-title mt-1">Prestasi terbaru</h2>
            </div>
            <Link href="/prestasi" className="text-sm font-semibold text-teal-700 hover:underline">Semua prestasi →</Link>
          </div>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {achievements.items.map((a) => (
              <li key={a.id} className="card border-t-4 !border-t-gold-500">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold-500">{ACHIEVEMENT_LEVEL_LABEL[a.level]}</p>
                <h3 className="mt-2 font-bold leading-snug text-navy-900">{a.title}</h3>
                {a.recipient && <p className="mt-1 text-sm text-teal-800">{a.recipient}</p>}
                <p className="mt-2 text-xs text-slate-500">{formatTanggalSaja(a.achieved_on)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(events.length > 0 || albums.items.length > 0) && (
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 lg:grid-cols-5">
          {events.length > 0 && (
            <div className={albums.items.length > 0 ? "lg:col-span-2" : "lg:col-span-5"} aria-labelledby="judul-agenda">
              <div className="flex items-end justify-between gap-4">
                <h2 id="judul-agenda" className="section-title">Agenda terdekat</h2>
                <Link href="/kalender" className="text-sm font-semibold text-teal-700 hover:underline">Kalender →</Link>
              </div>
              <ul className="mt-6 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="card !p-4">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${EVENT_CATEGORY_STYLE[e.category]}`}>{EVENT_CATEGORY_LABEL[e.category]}</span>
                    <h3 className="mt-2 font-semibold text-navy-900">{e.title}</h3>
                    <p className="text-sm text-slate-600">{formatEventDate(e)}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {albums.items.length > 0 && (
            <div className={events.length > 0 ? "lg:col-span-3" : "lg:col-span-5"} aria-labelledby="judul-galeri">
              <div className="flex items-end justify-between gap-4">
                <h2 id="judul-galeri" className="section-title">Galeri kegiatan</h2>
                <Link href="/galeri" className="text-sm font-semibold text-teal-700 hover:underline">Semua album →</Link>
              </div>
              <ul className="mt-6 grid grid-cols-2 gap-4">
                {albums.items.map((a) => {
                  const cover = a.cover?.image_url ?? albumFallback.get(a.id) ?? null;
                  return (
                    <li key={a.id}>
                      <Link href={`/galeri/${a.slug}`} className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-navy-900">
                        {cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.03]" />
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 to-transparent p-3 text-sm font-semibold text-white">{a.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 pb-6" aria-labelledby="judul-rasa">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 to-navy-900 p-8 text-white shadow-lg sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-400">Ruang aman</p>
          <h2 id="judul-rasa" className="mt-2 text-2xl font-extrabold sm:text-3xl">Ruang Rasa</h2>
          <p className="mt-3 max-w-2xl text-slate-100">
            Mengalami atau melihat perundungan? Ceritakan dengan aman, boleh tanpa nama. Hanya Guru BK yang ditugaskan yang membacanya.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/ruang-rasa" className="btn-gold">Tulis laporan</Link>
            <Link href="/ruang-rasa/cek" className="btn-ghost-light">Cek balasan</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2" aria-label="Layanan">
        <div className="card relative overflow-hidden !p-8">
          <span aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-50" />
          <p className="eyebrow relative">Perpustakaan digital</p>
          <h2 className="relative mt-2 text-xl font-bold text-navy-900">Bacaan & bahan belajar</h2>
          <p className="relative mt-2 text-sm leading-relaxed text-slate-600">
            Koleksi digital sekolah dan tautan ke Portal Buku Kemendikdasmen untuk buku teks dan bacaan resmi.
          </p>
          <div className="relative mt-5 flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/perpustakaan" className="text-teal-700 hover:underline">Buka perpustakaan <span aria-hidden>→</span></Link>
            <a href={PORTAL_BUKU_URL} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">Portal Buku Kemendikdasmen <span aria-hidden>↗</span></a>
          </div>
        </div>
        <SubscribeForm source="beranda" />
      </section>
    </>
  );
}
