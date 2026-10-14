import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { requireRole } from "@/lib/auth/dal";
import { getEmailProviderStatus } from "@/lib/newsletter/service";
import { formatTanggal } from "@/lib/site";
import { anonymizeSubscriberAction } from "../actions";
import { LanggananNav } from "./subnav";

export const metadata: Metadata = { title: "Langganan Berita" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Belum konfirmasi",
  active: "Aktif",
  unsubscribed: "Berhenti",
};
const PER_PAGE = 50;

type Subscriber = {
  id: string;
  email: string | null;
  status: string;
  requested_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  anonymized_at: string | null;
  source: string | null;
};

export default async function LanggananPage({ searchParams }: PageProps<"/admin/langganan">) {
  const ctx = await requireRole(["admin"], "/admin/langganan");
  const sp = await searchParams;
  const db = ctx.supabase;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const pageRaw = Number(typeof sp.halaman === "string" ? sp.halaman : "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const countBy = (s: string) =>
    db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", s);
  const [active, pending, unsubscribed] = await Promise.all([countBy("active"), countBy("pending"), countBy("unsubscribed")]);

  let query = db
    .from("newsletter_subscribers")
    .select("id, email, status, requested_at, confirmed_at, unsubscribed_at, anonymized_at, source", { count: "exact" })
    .order("requested_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (status) query = query.eq("status", status);
  // Escape wildcard ILIKE agar input admin diperlakukan sebagai teks biasa.
  if (q) query = query.ilike("email", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as Subscriber[];
  const provider = getEmailProviderStatus();

  const params = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), ...extra });
    return `/admin/langganan?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-900">Langganan Berita</h1>
        <LanggananNav />
      </div>
      {!provider.configured && <Alert tone="warning">Penyedia email belum aktif: {provider.reason}</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><p className="text-sm text-slate-500">Aktif</p><p className="text-3xl font-bold">{active.count ?? 0}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Belum konfirmasi</p><p className="text-3xl font-bold">{pending.count ?? 0}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Berhenti berlangganan</p><p className="text-3xl font-bold">{unsubscribed.count ?? 0}</p></div>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <label htmlFor="q" className="label">Cari email</label>
          <input id="q" name="q" defaultValue={q} className="input" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">Semua</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Terapkan</button>
        <a href="/admin/langganan/ekspor" className="btn-secondary">Unduh CSV pelanggan aktif</a>
      </form>
      <p className="text-xs text-slate-500">
        Daftar ini rahasia: hanya untuk admin berwenang dan keperluan operasional sesuai kebijakan privasi. Unduhan dicatat di log audit.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Daftar</th>
              <th className="px-4 py-2">Konfirmasi</th>
              <th className="px-4 py-2">Sumber</th>
              <th className="px-4 py-2"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{s.email ?? <em className="text-slate-400">dianonimkan</em>}</td>
                <td className="px-4 py-2">{STATUS_LABEL[s.status] ?? s.status}</td>
                <td className="px-4 py-2">{formatTanggal(s.requested_at)}</td>
                <td className="px-4 py-2">{s.confirmed_at ? formatTanggal(s.confirmed_at) : "—"}</td>
                <td className="px-4 py-2">{s.source ?? "—"}</td>
                <td className="px-4 py-2">
                  {!s.anonymized_at && (
                    <ActionForm action={anonymizeSubscriberAction} submitLabel="Hapus/anonimkan" className="flex items-center gap-2" submitClassName="text-xs font-semibold text-red-700 hover:underline">
                      <input type="hidden" name="subscriberId" value={s.id} />
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input type="checkbox" name="confirm" required /> yakin
                      </label>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Tidak ada data.</td></tr>}
          </tbody>
        </table>
      </div>
      <nav className="flex items-center gap-3 text-sm">
        {page > 1 && <Link href={params({ halaman: String(page - 1) })} className="btn-secondary">← Sebelumnya</Link>}
        <span className="text-slate-600">{count ?? 0} data</span>
        {page * PER_PAGE < (count ?? 0) && <Link href={params({ halaman: String(page + 1) })} className="btn-secondary">Berikutnya →</Link>}
      </nav>
    </div>
  );
}
