import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementList } from "@/components/announcement-list";
import { Alert } from "@/components/alert";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";
import { listAnnouncements } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Dashboard Guru BK" };

// Ringkasan Guru BK. Ruang Rasa (laporan siswa) hanya terlihat oleh Guru BK yang
// ditugaskan Super Admin; di sini hanya jumlah, tanpa isi.
export default async function DashboardBkPage({ searchParams }: PageProps<"/dashboard/bk">) {
  const ctx = await requireRole(["guru_bk"], "/dashboard/bk");
  const sp = await searchParams;
  const [announcements, rasa] = await Promise.all([listAnnouncements(ctx, 5), ctx.supabase.rpc("rasa_list_reports")]);
  const isHandler = !rasa.error;
  const rows = (rasa.data ?? []) as { status: string; urgent: boolean; last_sender: string | null }[];
  const open = rows.filter((r) => r.status !== "selesai");
  const attention = open.filter((r) => r.status === "baru" || r.last_sender === "pelapor").length;
  const urgent = open.filter((r) => r.urgent).length;
  return (
    <DashboardShell title="Dashboard Guru BK" role="guru_bk" greeting={`Selamat datang, ${ctx.profile.full_name ?? ""}`} error={authErrorMessage(sp.error)}>
      {isHandler ? (
        <section className={`card border-l-4 ${attention > 0 ? "!border-l-gold-500" : "!border-l-teal-600"}`}>
          <h2 className="text-lg font-semibold">Ruang Rasa</h2>
          <p className="mt-1 text-sm text-slate-700">
            {attention > 0 ? <><strong>{attention} laporan</strong> membutuhkan perhatian{urgent > 0 ? <> ({urgent} ditandai mendesak)</> : null}.</> : "Tidak ada laporan yang menunggu tindakan."}
          </p>
          <Link href="/dashboard/bk/ruang-rasa" prefetch={false} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Buka Ruang Rasa →</Link>
        </section>
      ) : (
        <Alert tone="info">
          Akun Anda belum ditugaskan sebagai petugas Ruang Rasa (laporan perundungan dari siswa). Hubungi Super Admin bila Anda seharusnya menanganinya.
        </Alert>
      )}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Pengumuman terbaru</h2>
        <AnnouncementList items={announcements} />
        <Link href="/dashboard/pengumuman" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Semua pengumuman →</Link>
      </section>
    </DashboardShell>
  );
}
