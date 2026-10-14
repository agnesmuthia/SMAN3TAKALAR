import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { deleteAchievementAction } from "../../konten/actions";
import { AchievementForm, type AchievementValues } from "../achievement-form";

export const metadata: Metadata = { title: "Ubah Prestasi" };

export default async function UbahPrestasiPage({ params, searchParams }: PageProps<"/admin/prestasi/[id]">) {
  const { id } = await params;
  const ctx = await requireNewsPublisher(`/admin/prestasi/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ data: row }, { data: news }] = await Promise.all([
    ctx.supabase
      .from("achievements")
      .select("id, title, recipient, level, organizer, achieved_on, description, image_url, news_id, is_published")
      .eq("id", id)
      .maybeSingle<AchievementValues>(),
    ctx.supabase.from("news").select("id, title").eq("status", "published").eq("visibility", "public").order("published_at", { ascending: false }).limit(100),
  ]);
  if (!row) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/prestasi" className="text-sm text-teal-700 hover:underline">← Prestasi</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Ubah Prestasi</h1>
        </div>
        {row.is_published && <Link href="/prestasi" target="_blank" className="btn-secondary">Lihat di website ↗</Link>}
      </div>
      {sp.disimpan === "1" && <Alert tone="success">Prestasi disimpan.</Alert>}
      <section className="card">
        <AchievementForm values={row} news={(news ?? []) as { id: string; title: string }[]} />
      </section>
      <section className="card">
        <h2 className="font-semibold text-red-800">Hapus prestasi</h2>
        <p className="mt-1 text-sm text-slate-600">Untuk menyembunyikan sementara, hapus centang &quot;Tampilkan di website&quot;.</p>
        <ActionForm action={deleteAchievementAction} submitLabel="Hapus prestasi" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin</label>
        </ActionForm>
      </section>
    </div>
  );
}
