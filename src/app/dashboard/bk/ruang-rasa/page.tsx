import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth/dal";
import { CATEGORY_LABEL, STAFF_STATUS_LABEL, type RasaCategory, type RasaSender, type RasaStatus } from "@/lib/rasa/labels";

export const metadata: Metadata = { title: "Ruang Rasa", robots: { index: false, follow: false } };

type Row = {
  id: string; reference_code: string; category: RasaCategory; urgent: boolean; status: RasaStatus;
  created_at: string; last_message_at: string | null; last_sender: RasaSender | null; assigned_name: string | null;
};
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" });
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Semua" }, { key: "baru", label: "Baru" }, { key: "diproses", label: "Diproses" }, { key: "selesai", label: "Selesai" },
];

export default async function RuangRasaBkPage({ searchParams }: PageProps<"/dashboard/bk/ruang-rasa">) {
  const ctx = await requireRole(["guru_bk"], "/dashboard/bk/ruang-rasa");
  const sp = await searchParams;
  const filter = typeof sp.status === "string" && ["baru", "diproses", "selesai"].includes(sp.status) ? sp.status : "";
  const { data, error } = await ctx.supabase.rpc("rasa_list_reports", { p_status: filter || null });

  return (
    <DashboardShell title="Ruang Rasa" role="guru_bk" greeting="Laporan dari siswa. Isi hanya dapat dibuka oleh Guru BK yang ditugaskan, dan setiap pembukaan tercatat.">
      {error?.code === "42501" ? (
        <Alert tone="warning">Akun Anda belum ditugaskan sebagai petugas Ruang Rasa. Hubungi Super Admin untuk penugasan.</Alert>
      ) : error ? (
        <Alert tone="error">Daftar laporan tidak dapat dimuat saat ini. Silakan coba lagi.</Alert>
      ) : (
        <>
          <nav aria-label="Saring status" className="flex flex-wrap gap-2 text-sm">
            {FILTERS.map((f) => (
              <Link key={f.key} href={f.key ? `/dashboard/bk/ruang-rasa?status=${f.key}` : "/dashboard/bk/ruang-rasa"} prefetch={false}
                aria-current={filter === f.key ? "page" : undefined}
                className={`rounded-full px-3 py-1 font-semibold ${filter === f.key ? "bg-navy-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>
                {f.label}
              </Link>
            ))}
          </nav>
          {((data ?? []) as Row[]).length === 0 ? (
            <p className="card text-sm text-slate-600">Belum ada laporan{filter ? " dengan status ini" : ""}.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-2">Kode</th><th className="px-3 py-2">Jenis</th><th className="px-3 py-2">Diterima</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Petugas</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {((data ?? []) as Row[]).map((r) => (
                    <tr key={r.id} className={r.urgent && r.status !== "selesai" ? "bg-red-50/60" : ""}>
                      <td className="px-3 py-2">
                        {/* prefetch dimatikan: membuka halaman rincian dicatat sebagai pembukaan laporan. */}
                        <Link href={`/dashboard/bk/ruang-rasa/${r.id}`} prefetch={false} className="font-mono font-semibold text-teal-700 hover:underline">{r.reference_code}</Link>
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-semibold">
                          {r.urgent && r.status !== "selesai" && <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">Mendesak</span>}
                          {r.last_sender === "pelapor" && r.status !== "selesai" && <span className="rounded-full bg-gold-500 px-2 py-0.5 text-navy-900">Balasan baru dari pelapor</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2">{CATEGORY_LABEL[r.category]}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{fmt.format(new Date(r.created_at))}</td>
                      <td className="px-3 py-2">{STAFF_STATUS_LABEL[r.status]}</td>
                      <td className="px-3 py-2 text-slate-600">{r.assigned_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
