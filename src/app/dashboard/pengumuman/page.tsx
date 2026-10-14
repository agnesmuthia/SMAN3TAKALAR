import type { Metadata } from "next";
import { AnnouncementList } from "@/components/announcement-list";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { listAnnouncements } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Pengumuman" };

export default async function PengumumanPage() {
  const ctx = await requireRole("any", "/dashboard/pengumuman");
  const items = await listAnnouncements(ctx, 50);
  return (
    <DashboardShell title="Pengumuman internal" role={ctx.profile.role}>
      <p className="text-sm text-slate-600">Pengumuman ini hanya terlihat oleh warga sekolah yang sudah login dan terverifikasi.</p>
      <AnnouncementList items={items} />
    </DashboardShell>
  );
}
