import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireSchoolAdmin } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";
import { deleteDecreeAction } from "../../sekolah/actions";
import { DecreeForm, type DecreeValues } from "../decree-form";

export const metadata: Metadata = { title: "Ubah SK" };

export default async function UbahSkPage({ params, searchParams }: PageProps<"/admin/arsip-sk/[id]">) {
  const { id } = await params;
  const ctx = await requireSchoolAdmin(`/admin/arsip-sk/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data: row }, { data: years }] = await Promise.all([
    ctx.supabase
      .from("decrees")
      .select("id, number, title, issued_on, issuer, academic_year_id, status, visibility, is_published, verified_at, file_size")
      .eq("id", id)
      .maybeSingle<DecreeValues>(),
    ctx.supabase.from("academic_years").select("id, name").order("starts_on", { ascending: false }),
  ]);
  if (!row) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/arsip-sk" className="text-sm text-teal-700 hover:underline">← Arsip SK</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Ubah SK</h1>
          <p className="font-mono text-xs text-slate-600">{row.number}</p>
        </div>
        <a href={`/dokumen/${row.id}/unduh`} target="_blank" rel="noopener" className="btn-secondary">Buka PDF ({Math.max(1, Math.round(row.file_size / 1024))} KB) ↗</a>
      </div>
      {sp.disimpan === "1" && <Alert tone="success">SK disimpan.</Alert>}
      {row.verified_at && <p className="text-xs text-slate-500">Diperiksa {formatWaktuWita(row.verified_at)}. Mengganti file mewajibkan pemeriksaan ulang.</p>}
      <section className="card">
        <DecreeForm values={row} years={(years ?? []) as { id: string; name: string }[]} />
      </section>
      <section className="card">
        <h2 className="font-semibold text-red-800">Hapus SK</h2>
        <p className="mt-1 text-sm text-slate-600">Menghapus data dan file PDF-nya secara permanen. Untuk SK yang sudah tidak berlaku, lebih baik ubah status menjadi &quot;Arsip&quot;.</p>
        <ActionForm action={deleteDecreeAction} submitLabel="Hapus SK" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin menghapus permanen</label>
        </ActionForm>
      </section>
    </div>
  );
}
