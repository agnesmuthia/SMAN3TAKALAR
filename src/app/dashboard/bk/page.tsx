import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Dashboard Guru BK" };

// Peran guru_bk hanya dapat diberikan admin (tidak pernah lewat Google atau
// pengajuan mandiri). Modul konseling/Ruang Rasa belum dibangun; saat
// dibangun, datanya wajib terpisah dari modul berita & buletin.
export default async function DashboardBkPage({ searchParams }: PageProps<"/dashboard/bk">) {
  const ctx = await requireRole(["guru_bk"], "/dashboard/bk");
  const sp = await searchParams;
  return (
    <DashboardShell title="Dashboard Guru BK" greeting={`Selamat datang, ${ctx.profile.full_name ?? ""}`} error={authErrorMessage(sp.error)}>
      <div className="card">
        <h2 className="font-semibold">Layanan bimbingan konseling</h2>
        <p className="mt-1 text-sm text-slate-600">Modul layanan BK akan ditambahkan pada tahap berikutnya.</p>
      </div>
    </DashboardShell>
  );
}
