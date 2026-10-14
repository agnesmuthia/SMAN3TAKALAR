import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import type { Assignment } from "@/lib/dashboard/data";
import { deleteAssignmentAction } from "../../../actions";
import { AssignmentForm } from "../assignment-form";

export const metadata: Metadata = { title: "Ubah tugas / materi" };

export default async function UbahTugasPage({ params }: PageProps<"/dashboard/guru/tugas/[id]">) {
  const { id } = await params;
  const ctx = await requireRole(["guru"], `/dashboard/guru/tugas/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  // RLS: guru lain tidak akan menemukan baris ini.
  const { data } = await ctx.supabase
    .from("assignments")
    .select("id, class_name, kind, title, description, link_url, due_at, published, created_at")
    .eq("id", id)
    .maybeSingle<Assignment>();
  if (!data) notFound();
  return (
    <DashboardShell title="Ubah tugas / materi" role="guru">
      <Link href="/dashboard/guru/tugas" className="text-sm text-brand-700 hover:underline">← Kembali</Link>
      <div className="card space-y-4"><AssignmentForm item={data} /></div>
      <div className="card">
        <h2 className="font-semibold">Hapus</h2>
        <ActionForm action={deleteAssignmentAction} submitLabel="Hapus permanen" className="mt-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={data.id} />
        </ActionForm>
      </div>
    </DashboardShell>
  );
}
