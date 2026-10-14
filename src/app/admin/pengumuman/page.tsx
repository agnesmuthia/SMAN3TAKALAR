import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { requireRole } from "@/lib/auth/dal";
import { formatTanggal } from "@/lib/site";

export const metadata: Metadata = { title: "Pengumuman internal" };

const STATUS: Record<string, string> = { draft: "Draf", published: "Terbit", archived: "Arsip" };
const AUDIENCE: Record<string, string> = { semua: "Semua", guru: "Guru", siswa: "Siswa", guru_bk: "Guru BK" };

export default async function AdminPengumumanPage({ searchParams }: PageProps<"/admin/pengumuman">) {
  const ctx = await requireRole(["admin"], "/admin/pengumuman");
  const sp = await searchParams;
  const { data } = await ctx.supabase
    .from("announcements")
    .select("id, title, audience, status, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as { id: string; title: string; audience: string; status: string; published_at: string | null }[];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-900">Pengumuman internal</h1>
        <Link href="/admin/pengumuman/baru" className="btn-primary">Tulis pengumuman</Link>
      </div>
      {sp.disimpan === "1" && <Alert tone="success">Pengumuman disimpan.</Alert>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-2">Judul</th><th className="px-4 py-2">Untuk</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Terbit</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/admin/pengumuman/${a.id}`} className="font-medium text-brand-700 hover:underline">{a.title}</Link></td>
                <td className="px-4 py-2">{AUDIENCE[a.audience] ?? a.audience}</td>
                <td className="px-4 py-2">{STATUS[a.status] ?? a.status}</td>
                <td className="px-4 py-2">{a.published_at ? formatTanggal(a.published_at) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Belum ada pengumuman.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
