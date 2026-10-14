import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import {
  EVENT_CATEGORY_LABEL,
  EVENT_CATEGORY_STYLE,
  MONTH_LABEL,
  WEEKDAY_SHORT,
  buildMonthGrid,
  formatEventDate,
  monthKey,
  monthRange,
  parseMonth,
  shiftMonth,
  todayInZone,
  type EventCategory,
} from "@/lib/content/calendar";
import { listEventsBetween } from "@/lib/content/public";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Kalender Kegiatan", description: "Agenda dan kalender kegiatan sekolah." };

export default async function KalenderPage({ searchParams }: PageProps<"/kalender">) {
  const sp = await searchParams;
  const today = todayInZone(siteConfig.timeZone);
  const current = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const { year, month } = parseMonth(sp.bulan, current);
  const { start, end } = monthRange(year, month);
  // RLS: pengunjung hanya mendapat kegiatan publik; anggota aktif juga internal.
  const events = await listEventsBetween(start, end);
  const grid = buildMonthGrid(year, month, events);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const isCurrent = year === current.year && month === current.month;
  const categories = [...new Set(events.map((e) => e.category))] as EventCategory[];

  return (
    <div>
      <PageHero eyebrow="Agenda sekolah" title="Kalender kegiatan" description="Jadwal kegiatan, ujian, dan hari libur sekolah. Waktu dalam WITA." />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-navy-900" aria-live="polite">{MONTH_LABEL[month - 1]} {year}</h2>
          <nav aria-label="Pilih bulan" className="flex flex-wrap gap-2">
            <Link href={`/kalender?bulan=${monthKey(prev.year, prev.month)}`} className="btn-secondary" rel="nofollow">← {MONTH_LABEL[prev.month - 1]}</Link>
            {!isCurrent && <Link href="/kalender" className="btn-secondary">Bulan ini</Link>}
            <Link href={`/kalender?bulan=${monthKey(next.year, next.month)}`} className="btn-secondary" rel="nofollow">{MONTH_LABEL[next.month - 1]} →</Link>
          </nav>
        </div>

        {categories.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2 text-xs" aria-label="Keterangan kategori">
            {categories.map((c) => <li key={c} className={`rounded-full border px-2 py-0.5 font-semibold ${EVENT_CATEGORY_STYLE[c]}`}>{EVENT_CATEGORY_LABEL[c]}</li>)}
          </ul>
        )}

        {/* Grid bulan (dekoratif untuk pembaca layar; daftar di bawah memuat info lengkap). */}
        <div aria-hidden className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-surface text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            {WEEKDAY_SHORT.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          {grid.map((week, w) => (
            <div key={w} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
              {week.map((cell) => (
                <div key={cell.date} className={`min-h-28 border-r border-slate-100 p-1.5 last:border-r-0 ${cell.inMonth ? "" : "bg-slate-50 text-slate-400"}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${cell.date === today ? "bg-navy-900 text-white" : ""}`}>{cell.day}</span>
                  <ul className="mt-1 space-y-1">
                    {cell.events.slice(0, 3).map((e) => (
                      <li key={e.id} className={`truncate rounded border px-1.5 py-0.5 text-[11px] font-medium ${EVENT_CATEGORY_STYLE[e.category]}`} title={e.title}>
                        {e.visibility === "internal" && "🔒 "}{e.title}
                      </li>
                    ))}
                    {cell.events.length > 3 && <li className="text-[11px] text-slate-500">+{cell.events.length - 3} lainnya</li>}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>

        <section className="mt-8" aria-labelledby="judul-daftar">
          <h2 id="judul-daftar" className="font-semibold text-navy-900">Daftar kegiatan {MONTH_LABEL[month - 1]} {year}</h2>
          {events.length === 0 ? (
            <p className="card mt-3 text-sm text-slate-600">Belum ada kegiatan yang dijadwalkan pada bulan ini.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {events.map((e) => (
                <li key={e.id} className="card !p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${EVENT_CATEGORY_STYLE[e.category]}`}>{EVENT_CATEGORY_LABEL[e.category]}</span>
                    {e.visibility === "internal" && <span className="rounded-full bg-navy-900 px-2 py-0.5 font-semibold text-white">Internal warga sekolah</span>}
                    <span className="text-slate-600">{formatEventDate(e)}</span>
                  </div>
                  <h3 className="mt-1 font-semibold text-navy-900">{e.title}</h3>
                  {e.location && <p className="text-sm text-slate-600">Tempat: {e.location}</p>}
                  {e.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{e.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
