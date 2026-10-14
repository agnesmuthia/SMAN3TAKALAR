import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Dashboard Guru" };

export default async function DashboardGuruPage({ searchParams }: PageProps<"/dashboard/guru">) {
  const ctx = await requireRole(["guru"], "/dashboard/guru");
  const sp = await searchParams;
  return (
    <DashboardShell title="Dashboard Guru" greeting={`Selamat datang, ${ctx.profile.full_name ?? ""}`} error={authErrorMessage(sp.error)}>
      <div className="card">
        <h2 className="font-semibold">Informasi internal</h2>
        <p className="mt-1 text-sm text-slate-600">
          Fitur khusus guru akan ditambahkan pada tahap berikutnya. Berita internal yang diterbitkan admin hanya
          dapat dibaca akun guru/siswa aktif.
        </p>
        <Link href="/berita" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">Berita sekolah →</Link>
      </div>
    </DashboardShell>
  );
}
