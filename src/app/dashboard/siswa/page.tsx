import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { AnnouncementList } from "@/components/announcement-list";
import { AssignmentCard } from "@/components/assignment-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { ScheduleView } from "@/components/schedule-view";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { listAnnouncements, listAssignmentsForStudent, listSchedule } from "@/lib/dashboard/data";
import { DAY_LABEL, dayOfWeekIn, entriesForDay } from "@/lib/dashboard/schedule";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = { title: "Dashboard Siswa" };

export default async function DashboardSiswaPage({ searchParams }: PageProps<"/dashboard/siswa">) {
  const ctx = await requireRole(["siswa"], "/dashboard/siswa");
  const sp = await searchParams;
  const [announcements, schedule, assignments] = await Promise.all([
    listAnnouncements(ctx, 3),
    listSchedule(ctx),
    listAssignmentsForStudent(ctx, 3),
  ]);
  const today = dayOfWeekIn(siteConfig.timeZone);

  return (
    <DashboardShell
      title="Dashboard Siswa"
      role="siswa"
      greeting={`Halo, ${ctx.profile.full_name ?? ""}${ctx.profile.class_name ? ` · Kelas ${ctx.profile.class_name}` : ""}`}
      error={authErrorMessage(sp.error)}
    >
      {!ctx.profile.class_name && (
        <Alert tone="warning">Kelas Anda belum tercatat sehingga jadwal dan tugas belum tampil. Hubungi admin sekolah.</Alert>
      )}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Jadwal hari ini{DAY_LABEL[today] ? ` (${DAY_LABEL[today]})` : ""}</h2>
        <ScheduleView entries={entriesForDay(schedule, today)} emptyText="Tidak ada jadwal pelajaran hari ini." />
        <Link href="/dashboard/siswa/jadwal" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Jadwal lengkap →</Link>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Tugas & materi terbaru</h2>
        {assignments.length ? (
          <div className="space-y-3">{assignments.map((a) => <AssignmentCard key={a.id} item={a} />)}</div>
        ) : (
          <p className="text-sm text-slate-600">Belum ada tugas atau materi.</p>
        )}
        <Link href="/dashboard/siswa/tugas" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Semua tugas & materi →</Link>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Pengumuman terbaru</h2>
        <AnnouncementList items={announcements} />
      </section>
    </DashboardShell>
  );
}
