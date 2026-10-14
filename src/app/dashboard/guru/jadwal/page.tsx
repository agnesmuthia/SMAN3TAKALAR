import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { ScheduleView } from "@/components/schedule-view";
import { requireRole } from "@/lib/auth/dal";
import { listSchedule } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Jadwal mengajar" };

export default async function JadwalGuruPage() {
  const ctx = await requireRole(["guru"], "/dashboard/guru/jadwal");
  const schedule = await listSchedule(ctx);
  return (
    <DashboardShell title="Jadwal mengajar" role="guru">
      <ScheduleView entries={schedule} showClass emptyText="Belum ada jadwal mengajar untuk Anda. Jadwal diatur oleh admin sekolah." />
    </DashboardShell>
  );
}
