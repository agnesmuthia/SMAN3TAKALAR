import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { PublishedBadge } from "@/components/cms/image-field";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { EVENT_CATEGORY_LABEL, EVENT_CATEGORY_STYLE, formatEventDate, todayInZone } from "@/lib/content/calendar";
import { siteConfig } from "@/lib/site";
import { EventForm, type EventValues } from "./event-form";

export const metadata: Metadata = { title: "Kalender Kegiatan" };

export default async function AdminKalenderPage({ searchParams }: PageProps<"/admin/kalender">) {
  const ctx = await requireNewsPublisher("/admin/kalender");
  const sp = await searchParams;
  const showPast = sp.lampau === "1";
  const today = todayInZone(siteConfig.timeZone);
  let query = ctx.supabase
    .from("calendar_events")
    .select("id, title, description, category, starts_on, ends_on, start_time, end_time, location, visibility, is_published");
  query = showPast ? query.lt("ends_on", today).order("starts_on", { ascending: false }) : query.gte("ends_on", today).order("starts_on");
  const { data } = await query.limit(200);
  const rows = (data ?? []) as EventValues[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Kalender Kegiatan</h1>
        <p className="text-sm text-slate-600">Kegiatan publik tampil di halaman Kalender. Kegiatan internal hanya terlihat oleh guru dan siswa yang sudah diverifikasi.</p>
      </div>
      {sp.disimpan === "1" && <Alert tone="success">Kegiatan ditambahkan.</Alert>}
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Tambah kegiatan</h2>
        <EventForm />
      </section>
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-navy-900">{showPast ? "Kegiatan yang sudah lewat" : "Kegiatan mendatang & berlangsung"} ({rows.length})</h2>
          <Link href={showPast ? "/admin/kalender" : "/admin/kalender?lampau=1"} className="text-sm text-teal-700 hover:underline">
            {showPast ? "Lihat kegiatan mendatang" : "Lihat kegiatan lampau"}
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Belum ada kegiatan.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {rows.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <Link href={`/admin/kalender/${e.id}`} className="font-medium text-navy-900 hover:underline">{e.title}</Link>
                  <p className="text-sm text-slate-600">{formatEventDate(e)}{e.location ? ` · ${e.location}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 font-semibold ${EVENT_CATEGORY_STYLE[e.category]}`}>{EVENT_CATEGORY_LABEL[e.category]}</span>
                  {e.visibility === "internal" && <span className="rounded-full bg-navy-900 px-2 py-0.5 font-semibold text-white">Internal</span>}
                  <PublishedBadge published={e.is_published} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
