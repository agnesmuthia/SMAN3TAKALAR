import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { formatTanggal } from "@/lib/site";

export const metadata: Metadata = { title: "Kelola berita" };

const STATUS: Record<string, string> = { draft: "Draf", published: "Terbit", archived: "Arsip" };
const VISIBILITY: Record<string, string> = { public: "Publik", internal: "Internal" };

export default async function AdminBeritaPage() {
  const ctx = await requireRole(["admin"], "/admin/berita");
  const { data } = await ctx.supabase
    .from("news")
    .select("id, title, status, visibility, published_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as { id: string; title: string; status: string; visibility: string; published_at: string | null; updated_at: string }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-900">Berita</h1>
        <Link href="/admin/berita/baru" className="btn-primary">Tulis berita</Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr><th className="px-4 py-2">Judul</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Akses</th><th className="px-4 py-2">Terbit</th></tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className="border-t border-slate-100">
                <td className="px-4 py-2"><Link href={`/admin/berita/${n.id}`} className="font-medium text-brand-700 hover:underline">{n.title}</Link></td>
                <td className="px-4 py-2">{STATUS[n.status] ?? n.status}</td>
                <td className="px-4 py-2">{VISIBILITY[n.visibility] ?? n.visibility}</td>
                <td className="px-4 py-2 text-slate-600">{n.published_at ? formatTanggal(n.published_at) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Belum ada berita.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
