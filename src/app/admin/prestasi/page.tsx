import type { Metadata } from "next";
import Link from "next/link";
import { PublishedBadge } from "@/components/cms/image-field";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { ACHIEVEMENT_LEVEL_LABEL, type AchievementLevel } from "@/lib/content/labels";
import { AchievementForm } from "./achievement-form";

export const metadata: Metadata = { title: "Prestasi" };

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function AdminPrestasiPage() {
  const ctx = await requireNewsPublisher("/admin/prestasi");
  const [{ data }, { data: news }] = await Promise.all([
    ctx.supabase.from("achievements").select("id, title, recipient, level, achieved_on, is_published").order("achieved_on", { ascending: false }).limit(200),
    ctx.supabase.from("news").select("id, title").eq("status", "published").eq("visibility", "public").order("published_at", { ascending: false }).limit(100),
  ]);
  const rows = (data ?? []) as { id: string; title: string; recipient: string | null; level: AchievementLevel; achieved_on: string; is_published: boolean }[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Prestasi</h1>
        <p className="text-sm text-slate-600">Prestasi yang ditampilkan muncul di halaman Prestasi dan beranda. Hanya masukkan prestasi yang sudah dipastikan kebenarannya.</p>
      </div>
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Tambah prestasi</h2>
        <AchievementForm news={(news ?? []) as { id: string; title: string }[]} />
      </section>
      <section className="card">
        <h2 className="font-semibold text-navy-900">Daftar prestasi ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Belum ada prestasi.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-3">Prestasi</th><th className="py-2 pr-3">Tingkat</th><th className="py-2 pr-3">Tanggal</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/prestasi/${r.id}`} className="font-medium text-navy-900 hover:underline">{r.title}</Link>
                      {r.recipient && <p className="text-xs text-slate-500">{r.recipient}</p>}
                    </td>
                    <td className="py-2 pr-3">{ACHIEVEMENT_LEVEL_LABEL[r.level]}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{dateFmt.format(new Date(`${r.achieved_on}T00:00:00Z`))}</td>
                    <td className="py-2"><PublishedBadge published={r.is_published} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
