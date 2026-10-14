import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { authErrorMessage } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Dashboard Siswa" };

export default async function DashboardSiswaPage({ searchParams }: PageProps<"/dashboard/siswa">) {
  const ctx = await requireRole(["siswa"], "/dashboard/siswa");
  const sp = await searchParams;
  return (
    <DashboardShell title="Dashboard Siswa" greeting={`Halo, ${ctx.profile.full_name ?? ""}`} error={authErrorMessage(sp.error)}>
      <div className="card">
        <h2 className="font-semibold">Layanan siswa</h2>
        <p className="mt-1 text-sm text-slate-600">Fitur khusus siswa akan ditambahkan pada tahap berikutnya.</p>
        <Link href="/berita" className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:underline">Berita sekolah →</Link>
      </div>
    </DashboardShell>
  );
}
