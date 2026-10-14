import type { Metadata } from "next";
import Link from "next/link";
import { PublishedBadge } from "@/components/cms/image-field";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { formatWaktuWita } from "@/lib/cms/time";

export const metadata: Metadata = { title: "Halaman" };

export default async function AdminHalamanPage() {
  const ctx = await requireNewsPublisher("/admin/halaman");
  const { data } = await ctx.supabase.from("site_pages").select("id, slug, title, is_published, position, updated_at").order("position").order("title");
  const rows = (data ?? []) as { id: string; slug: string; title: string; is_published: boolean; position: number; updated_at: string }[];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Halaman</h1>
          <p className="text-sm text-slate-600">Profil, visi-misi, sejarah, struktur organisasi, dan halaman informasi lain. Tampil di menu <strong>Profil</strong>.</p>
        </div>
        <Link href="/admin/halaman/baru" className="btn-primary">+ Tambah halaman</Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-2">Urutan</th><th className="px-4 py-2">Judul</th><th className="px-4 py-2">Alamat</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Diperbarui</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-500">{r.position}</td>
                <td className="px-4 py-2"><Link href={`/admin/halaman/${r.id}`} className="font-medium text-teal-700 hover:underline">{r.title}</Link></td>
                <td className="px-4 py-2 font-mono text-xs text-slate-500">/profil/{r.slug}</td>
                <td className="px-4 py-2"><PublishedBadge published={r.is_published} /></td>
                <td className="px-4 py-2 text-slate-600">{formatWaktuWita(r.updated_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Belum ada halaman. Mulai dengan &quot;Visi dan Misi&quot; atau &quot;Sejarah Sekolah&quot;.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
