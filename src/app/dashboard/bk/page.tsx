import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementList } from "@/components/announcement-list";
import { Alert } from "@/components/alert";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { listAnnouncements } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Dashboard Guru BK" };

// Kerangka aman: peran guru_bk hanya dapat diberikan admin. Modul layanan
// konseling / Ruang Rasa BELUM dibangun dan sengaja tidak menyimpan data apa
// pun. Saat dibangun, datanya wajib di tabel terpisah dengan RLS ketat dan
// tidak boleh dirujuk modul berita, buletin, jadwal, atau tugas.
export default async function DashboardBkPage({ searchParams }: PageProps<"/dashboard/bk">) {
  const ctx = await requireRole(["guru_bk"], "/dashboard/bk");
  const sp = await searchParams;
  const announcements = await listAnnouncements(ctx, 5);
  return (
    <DashboardShell title="Dashboard Guru BK" role="guru_bk" greeting={`Selamat datang, ${ctx.profile.full_name ?? ""}`} error={authErrorMessage(sp.error)}>
      <Alert tone="info">
        Modul layanan bimbingan konseling (termasuk Ruang Rasa) belum tersedia. Saat ini belum ada data konseling yang
        disimpan di website ini.
      </Alert>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Pengumuman terbaru</h2>
        <AnnouncementList items={announcements} />
        <Link href="/dashboard/pengumuman" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Semua pengumuman →</Link>
      </section>
    </DashboardShell>
  );
}
