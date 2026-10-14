import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementList } from "@/components/announcement-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { ScheduleView } from "@/components/schedule-view";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { listAnnouncements, listAssignmentsForTeacher, listSchedule } from "@/lib/dashboard/data";
import { DAY_LABEL, dayOfWeekIn, entriesForDay } from "@/lib/dashboard/schedule";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Dashboard Guru" };

export default async function DashboardGuruPage({ searchParams }: PageProps<"/dashboard/guru">) {
  const ctx = await requireRole(["guru"], "/dashboard/guru");
  const sp = await searchParams;
  const [announcements, schedule, assignments] = await Promise.all([
    listAnnouncements(ctx, 3),
    listSchedule(ctx),
    listAssignmentsForTeacher(ctx, 100),
  ]);
  const today = dayOfWeekIn(siteConfig.timeZone);
  const todayEntries = entriesForDay(schedule, today);
  const drafts = assignments.filter((a) => !a.published).length;

  return (
    <DashboardShell title="Dashboard Guru" role="guru" greeting={`Selamat datang, ${ctx.profile.full_name ?? ""}`} error={authErrorMessage(sp.error)}>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Mengajar hari ini{DAY_LABEL[today] ? ` (${DAY_LABEL[today]})` : ""}</h2>
        <ScheduleView entries={todayEntries} showClass emptyText="Tidak ada jadwal mengajar hari ini." />
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/guru/tugas" className="card hover:border-brand-600">
          <p className="text-sm text-slate-500">Tugas & materi saya</p>
          <p className="text-3xl font-bold text-brand-900">{assignments.length}</p>
          <p className="text-xs text-slate-500">{draftLabel(drafts)}</p>
        </Link>
        <Link href="/dashboard/guru/jadwal" className="card hover:border-brand-600">
          <p className="text-sm text-slate-500">Sesi mengajar per pekan</p>
          <p className="text-3xl font-bold text-brand-900">{schedule.length}</p>
        </Link>
        <Link href="/dashboard/pengumuman" className="card hover:border-brand-600">
          <p className="text-sm text-slate-500">Pengumuman belum dibaca</p>
          <p className="text-3xl font-bold text-brand-900">{announcements.filter((a) => !a.read).length}</p>
        </Link>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Pengumuman terbaru</h2>
        <AnnouncementList items={announcements} />
      </section>
    </DashboardShell>
  );
}

function draftLabel(n: number): string {
  return n > 0 ? `${n} masih draf` : "Semua sudah terbit";
}
