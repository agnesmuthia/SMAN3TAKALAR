import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Pager } from "@/components/pager";
import { DECREE_STATUS_LABEL } from "@/lib/school/labels";
import { listAcademicYears, listDecrees } from "@/lib/school/public";
import { normalizeSearch, parsePage } from "@/lib/news-utils";
import { formatTanggalSaja } from "@/lib/site";

export const metadata: Metadata = { title: "Arsip SK", description: "Arsip Surat Keputusan sekolah." };

const PAGE_SIZE = 20;

export default async function DokumenPage({ searchParams }: PageProps<"/dokumen">) {
  const sp = await searchParams;
  const q = normalizeSearch(sp.q);
  const page = parsePage(sp.halaman);
  const status = sp.status === "berlaku" || sp.status === "arsip" ? sp.status : undefined;
  const years = await listAcademicYears();
  const yearId = years.find((y) => y.id === sp.tahun)?.id;
  const { items, total } = await listDecrees({ q, status, yearId }, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || status || yearId);

  return (
    <div>
      <PageHero eyebrow="Dokumen resmi" title="Arsip SK" description="Surat Keputusan sekolah yang dipublikasikan. SK internal hanya terlihat oleh warga sekolah yang sudah masuk.">
        <form method="get" role="search" className="mt-6 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label htmlFor="q" className="label">Cari nomor atau perihal</label>
            <input id="q" name="q" type="search" defaultValue={q} maxLength={80} className="input !py-2" />
          </div>
          <div>
            <label htmlFor="status" className="label">Status</label>
            <select id="status" name="status" defaultValue={status ?? ""} className="input !py-2">
              <option value="">Semua</option>
              <option value="berlaku">Masih berlaku</option>
              <option value="arsip">Arsip</option>
            </select>
          </div>
          {years.length > 0 && (
            <div>
              <label htmlFor="tahun" className="label">Tahun ajaran</label>
              <select id="tahun" name="tahun" defaultValue={yearId ?? ""} className="input !py-2">
                <option value="">Semua</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" className="btn-primary">Cari</button>
          {filtered && <Link href="/dokumen" className="btn-secondary">Atur ulang</Link>}
        </form>
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {items.length === 0 ? (
          <EmptyState
            title={filtered ? "Tidak ada SK yang cocok." : "Belum ada SK yang dipublikasikan."}
            text={filtered ? "Coba kata kunci atau saringan lain." : "SK akan tampil di sini setelah diperiksa dan dipublikasikan petugas."}
          />
        ) : (
          <ul className="space-y-3">
            {items.map((d) => (
              <li key={d.id} className="card flex flex-wrap items-start justify-between gap-4 !p-5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-slate-500">{d.number}</p>
                  <h2 className="mt-1 font-bold leading-snug text-navy-900">{d.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Ditetapkan {formatTanggalSaja(d.issued_on)}{d.issuer ? ` oleh ${d.issuer}` : ""}{d.year ? ` · TA ${d.year.name}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${d.status === "berlaku" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>{DECREE_STATUS_LABEL[d.status]}</span>
                    {d.visibility === "internal" && <span className="rounded-full bg-navy-900 px-2 py-0.5 font-semibold text-white">Internal</span>}
                  </div>
                </div>
                <a href={`/dokumen/${d.id}/unduh`} target="_blank" rel="noopener" className="btn-secondary shrink-0">Unduh PDF</a>
              </li>
            ))}
          </ul>
        )}
        <Pager base="/dokumen" params={{ q, status: status ?? "", tahun: yearId ?? "" }} page={page} lastPage={lastPage} />
      </div>
    </div>
  );
}
