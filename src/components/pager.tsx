import Link from "next/link";
import { pageHref } from "@/lib/news-utils";

// Navigasi halaman sederhana (sebelumnya/berikutnya) untuk daftar publik.
export function Pager({ base, params, page, lastPage }: { base: string; params: Record<string, string | number>; page: number; lastPage: number }) {
  if (lastPage <= 1) return null;
  return (
    <nav aria-label="Halaman" className="mt-10 flex items-center justify-between gap-3">
      {page > 1 ? <Link href={pageHref(base, { ...params, halaman: page - 1 })} className="btn-secondary">← Sebelumnya</Link> : <span />}
      <span className="text-sm text-slate-500">Halaman {page} dari {lastPage}</span>
      {page < lastPage ? <Link href={pageHref(base, { ...params, halaman: page + 1 })} className="btn-secondary">Berikutnya →</Link> : <span />}
    </nav>
  );
}
