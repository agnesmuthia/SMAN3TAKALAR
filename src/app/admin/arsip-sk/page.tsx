import type { Metadata } from "next";
import Link from "next/link";
import { PublishedBadge } from "@/components/cms/image-field";
import { requireSchoolAdmin } from "@/lib/auth/dal";
import { DECREE_STATUS_LABEL, VISIBILITY_LABEL } from "@/lib/school/labels";
import { formatTanggalSaja } from "@/lib/site";
import { DecreeForm } from "./decree-form";

export const metadata: Metadata = { title: "Arsip SK" };

export default async function AdminArsipSkPage({ searchParams }: PageProps<"/admin/arsip-sk">) {
  const ctx = await requireSchoolAdmin("/admin/arsip-sk");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  let query = ctx.supabase
    .from("decrees")
    .select("id, number, title, issued_on, status, visibility, is_published, verified_at")
    .order("issued_on", { ascending: false })
    .limit(200);
  if (q) query = query.or(`number.ilike.%${q.replace(/[%,()*]/g, " ")}%,title.ilike.%${q.replace(/[%,()*]/g, " ")}%`);
  const [{ data }, { data: years }] = await Promise.all([
    query,
    ctx.supabase.from("academic_years").select("id, name").order("starts_on", { ascending: false }),
  ]);
  const rows = (data ?? []) as {
    id: string; number: string; title: string; issued_on: string; status: "berlaku" | "arsip";
    visibility: "public" | "internal"; is_published: boolean; verified_at: string | null;
  }[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Arsip SK</h1>
        <p className="text-sm text-slate-600">Simpan Surat Keputusan beserta PDF-nya. SK baru tampil setelah diperiksa dan dicentang &quot;Tampilkan&quot;.</p>
      </div>
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Tambah SK</h2>
        <DecreeForm years={(years ?? []) as { id: string; name: string }[]} />
      </section>
      <section className="card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold text-navy-900">Daftar SK ({rows.length})</h2>
          <form method="get" role="search" className="flex gap-2">
            <label htmlFor="q" className="sr-only">Cari SK</label>
            <input id="q" name="q" type="search" defaultValue={q} placeholder="Nomor atau perihal" className="input !py-1.5" />
            <button type="submit" className="btn-secondary !py-1.5">Cari</button>
          </form>
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{q ? "Tidak ada SK yang cocok." : "Belum ada SK."}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-3">Nomor & perihal</th><th className="py-2 pr-3">Tanggal</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Akses</th><th className="py-2">Tampil</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/arsip-sk/${r.id}`} className="font-mono text-xs text-slate-600 hover:underline">{r.number}</Link>
                      <p className="font-medium text-navy-900">{r.title}</p>
                      {!r.verified_at && <p className="text-xs font-semibold text-amber-700">Belum diperiksa</p>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">{formatTanggalSaja(r.issued_on)}</td>
                    <td className="py-2 pr-3">{DECREE_STATUS_LABEL[r.status]}</td>
                    <td className="py-2 pr-3">{VISIBILITY_LABEL[r.visibility]}</td>
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
