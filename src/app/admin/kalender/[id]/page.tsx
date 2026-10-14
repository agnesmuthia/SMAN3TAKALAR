import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { deleteEventAction } from "../../konten/actions";
import { EventForm, type EventValues } from "../event-form";

export const metadata: Metadata = { title: "Ubah Kegiatan" };

export default async function UbahKegiatanPage({ params }: PageProps<"/admin/kalender/[id]">) {
  const { id } = await params;
  const ctx = await requireNewsPublisher(`/admin/kalender/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: row } = await ctx.supabase
    .from("calendar_events")
    .select("id, title, description, category, starts_on, ends_on, start_time, end_time, location, visibility, is_published")
    .eq("id", id)
    .maybeSingle<EventValues>();
  if (!row) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/kalender" className="text-sm text-teal-700 hover:underline">← Kalender</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Ubah Kegiatan</h1>
        </div>
        {row.is_published && <Link href={`/kalender?bulan=${row.starts_on.slice(0, 7)}`} target="_blank" className="btn-secondary">Lihat di website ↗</Link>}
      </div>
      <section className="card">
        <EventForm values={row} />
      </section>
      <section className="card">
        <h2 className="font-semibold text-red-800">Hapus kegiatan</h2>
        <p className="mt-1 text-sm text-slate-600">Untuk menyembunyikan sementara, hapus centang &quot;Tampilkan di kalender&quot;.</p>
        <ActionForm action={deleteEventAction} submitLabel="Hapus kegiatan" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={row.id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin</label>
        </ActionForm>
      </section>
    </div>
  );
}
