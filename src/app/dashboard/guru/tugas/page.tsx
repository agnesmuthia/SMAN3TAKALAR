import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { listAssignmentsForTeacher } from "@/lib/dashboard/data";
import { formatTanggal } from "@/lib/site";
import { AssignmentForm } from "./assignment-form";

export const metadata: Metadata = { title: "Tugas & materi" };

export default async function TugasGuruPage({ searchParams }: PageProps<"/dashboard/guru/tugas">) {
  const ctx = await requireRole(["guru"], "/dashboard/guru/tugas");
  const sp = await searchParams;
  const items = await listAssignmentsForTeacher(ctx);
  return (
    <DashboardShell title="Tugas & materi" role="guru">
      {sp.disimpan === "1" && <Alert tone="success">Tersimpan.</Alert>}
      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Buat baru</h2>
        <AssignmentForm />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Milik saya</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr><th className="px-4 py-2">Judul</th><th className="px-4 py-2">Jenis</th><th className="px-4 py-2">Kelas</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Dibuat</th></tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2"><Link href={`/dashboard/guru/tugas/${a.id}`} className="font-medium text-brand-700 hover:underline">{a.title}</Link></td>
                  <td className="px-4 py-2">{a.kind === "tugas" ? "Tugas" : "Materi"}</td>
                  <td className="px-4 py-2">{a.class_name}</td>
                  <td className="px-4 py-2">{a.published ? "Terbit" : "Draf"}</td>
                  <td className="px-4 py-2">{formatTanggal(a.created_at)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Belum ada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
