import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { ScheduleView } from "@/components/schedule-view";
import { requireRole } from "@/lib/auth/dal";
import { activeSemesterName, listSchedule } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Jadwal pelajaran" };

export default async function JadwalSiswaPage() {
  const ctx = await requireRole(["siswa"], "/dashboard/siswa/jadwal");
  const [schedule, semester] = await Promise.all([listSchedule(ctx), activeSemesterName(ctx)]);
  return (
    <DashboardShell title={`Jadwal pelajaran${ctx.profile.class_name ? ` · Kelas ${ctx.profile.class_name}` : ""}`} role="siswa">
      {semester && <p className="mb-4 text-sm text-slate-600">Tahun ajaran {semester}</p>}
      <ScheduleView entries={schedule} emptyText="Jadwal kelas Anda belum diisi admin." />
    </DashboardShell>
  );
}
