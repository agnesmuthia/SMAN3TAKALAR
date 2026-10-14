import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { ScheduleView } from "@/components/schedule-view";
import { requireRole } from "@/lib/auth/dal";
import { listSchedule } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Jadwal pelajaran" };

export default async function JadwalSiswaPage() {
  const ctx = await requireRole(["siswa"], "/dashboard/siswa/jadwal");
  const schedule = await listSchedule(ctx);
  return (
    <DashboardShell title={`Jadwal pelajaran${ctx.profile.class_name ? ` · Kelas ${ctx.profile.class_name}` : ""}`} role="siswa">
      <ScheduleView entries={schedule} emptyText="Jadwal kelas Anda belum diisi admin." />
    </DashboardShell>
  );
}
