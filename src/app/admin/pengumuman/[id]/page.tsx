import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { deleteAnnouncementAction } from "../../actions";
import { AnnouncementForm, type AnnouncementValues } from "../announcement-form";

export const metadata: Metadata = { title: "Ubah pengumuman" };

export default async function UbahPengumumanPage({ params }: PageProps<"/admin/pengumuman/[id]">) {
  const { id } = await params;
  const ctx = await requireNewsPublisher(`/admin/pengumuman/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await ctx.supabase
    .from("announcements")
    .select("id, title, body, audience, status")
    .eq("id", id)
    .maybeSingle<AnnouncementValues>();
  if (!data) notFound();
  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold text-brand-900">Ubah pengumuman</h1>
        <AnnouncementForm values={data} />
      </div>
      <div className="card">
        <h2 className="font-semibold">Hapus pengumuman</h2>
        <ActionForm action={deleteAnnouncementAction} submitLabel="Hapus permanen" className="mt-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={data.id} />
        </ActionForm>
      </div>
    </div>
  );
}
