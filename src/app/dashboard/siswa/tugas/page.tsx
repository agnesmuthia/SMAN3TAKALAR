import type { Metadata } from "next";
import { AssignmentCard } from "@/components/assignment-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { listAssignmentsForStudent } from "@/lib/dashboard/data";

export const metadata: Metadata = { title: "Tugas & materi" };

export default async function TugasSiswaPage() {
  const ctx = await requireRole(["siswa"], "/dashboard/siswa/tugas");
  const items = await listAssignmentsForStudent(ctx);
  return (
    <DashboardShell title="Tugas & materi" role="siswa">
      {items.length ? (
        <div className="space-y-3">{items.map((a) => <AssignmentCard key={a.id} item={a} />)}</div>
      ) : (
        <p className="text-sm text-slate-600">Belum ada tugas atau materi untuk kelas Anda.</p>
      )}
    </DashboardShell>
  );
}
