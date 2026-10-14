import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Pager } from "@/components/pager";
import { listAchievementYears, listAchievements } from "@/lib/content/public";
import { ACHIEVEMENT_LEVELS, ACHIEVEMENT_LEVEL_LABEL, type AchievementLevel } from "@/lib/content/labels";
import { parsePage } from "@/lib/news-utils";
import { formatTanggalSaja } from "@/lib/site";

export const metadata: Metadata = { title: "Prestasi", description: "Prestasi siswa, guru, dan sekolah." };

const PAGE_SIZE = 18;

export default async function PrestasiPage({ searchParams }: PageProps<"/prestasi">) {
  const sp = await searchParams;
  const page = parsePage(sp.halaman);
  const level = ACHIEVEMENT_LEVELS.find((l) => l === sp.tingkat) as AchievementLevel | undefined;
  const years = await listAchievementYears();
  const yearRaw = Number(typeof sp.tahun === "string" ? sp.tahun : NaN);
  const year = years.includes(yearRaw) ? yearRaw : undefined;
  const { items, total } = await listAchievements({ level, year }, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(level || year);

  return (
    <div>
      <PageHero eyebrow="Kebanggaan sekolah" title="Prestasi" description="Capaian siswa, guru, dan sekolah di berbagai tingkat.">
        {years.length > 0 && (
          <form method="get" className="mt-6 flex flex-wrap items-end gap-3" aria-label="Saring prestasi">
            <div>
              <label htmlFor="tingkat" className="label">Tingkat</label>
              <select id="tingkat" name="tingkat" defaultValue={level ?? ""} className="input !py-2">
                <option value="">Semua tingkat</option>
                {ACHIEVEMENT_LEVELS.map((l) => <option key={l} value={l}>{ACHIEVEMENT_LEVEL_LABEL[l]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tahun" className="label">Tahun</label>
              <select id="tahun" name="tahun" defaultValue={year ?? ""} className="input !py-2">
                <option value="">Semua tahun</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary">Terapkan</button>
            {filtered && <Link href="/prestasi" className="btn-secondary">Atur ulang</Link>}
          </form>
        )}
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {items.length === 0 ? (
          <EmptyState
            title={filtered ? "Tidak ada prestasi untuk saringan ini." : "Belum ada prestasi yang ditampilkan."}
            text={filtered ? "Coba ubah tingkat atau tahun." : "Prestasi akan tampil di sini setelah diterbitkan pengelola website."}
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <li key={a.id} className="card flex flex-col overflow-hidden !p-0">
                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-gold-500/20 px-2 py-0.5 font-semibold text-navy-900">{ACHIEVEMENT_LEVEL_LABEL[a.level]}</span>
                    <time dateTime={a.achieved_on} className="text-slate-500">{formatTanggalSaja(a.achieved_on)}</time>
                  </div>
                  <h2 className="mt-2 font-bold leading-snug text-navy-900">{a.title}</h2>
                  {a.recipient && <p className="mt-1 text-sm font-medium text-teal-800">{a.recipient}</p>}
                  {a.organizer && <p className="mt-1 text-xs text-slate-500">Penyelenggara: {a.organizer}</p>}
                  {a.description && <p className="mt-2 line-clamp-4 text-sm text-slate-600">{a.description}</p>}
                  {a.news && (
                    <Link href={`/berita/${a.news.slug}`} className="mt-auto pt-3 text-sm font-semibold text-teal-700 hover:underline">
                      Baca beritanya <span aria-hidden>→</span>
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager base="/prestasi" params={{ tingkat: level ?? "", tahun: year ?? "" }} page={page} lastPage={lastPage} />
      </div>
    </div>
  );
}
