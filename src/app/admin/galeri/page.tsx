import type { Metadata } from "next";
import Link from "next/link";
import { PublishedBadge } from "@/components/cms/image-field";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { formatTanggal } from "@/lib/site";
import { AlbumForm } from "./album-form";

export const metadata: Metadata = { title: "Galeri" };

export default async function AdminGaleriPage() {
  const ctx = await requireNewsPublisher("/admin/galeri");
  const { data } = await ctx.supabase
    .from("gallery_albums")
    .select("id, title, event_date, is_published, gallery_photos(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as { id: string; title: string; event_date: string | null; is_published: boolean; gallery_photos: { count: number }[] }[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Galeri</h1>
        <p className="text-sm text-slate-600">Buat album, lalu unggah foto di halaman album. Album baru tampil setelah izin publikasi dikonfirmasi dan dicentang &quot;Tampilkan&quot;.</p>
      </div>
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Album baru</h2>
        <AlbumForm values={{ title: "", slug: "", description: "", eventDate: "", isPublished: false, consentConfirmed: false }} />
      </section>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-2">Album</th><th className="px-4 py-2">Tanggal</th><th className="px-4 py-2">Foto</th><th className="px-4 py-2">Status</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/admin/galeri/${a.id}`} className="font-medium text-teal-700 hover:underline">{a.title}</Link></td>
                <td className="px-4 py-2 text-slate-600">{a.event_date ? formatTanggal(a.event_date) : "—"}</td>
                <td className="px-4 py-2 text-slate-600">{a.gallery_photos?.[0]?.count ?? 0}</td>
                <td className="px-4 py-2"><PublishedBadge published={a.is_published} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Belum ada album.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
