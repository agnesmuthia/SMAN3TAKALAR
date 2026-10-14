import type { Metadata } from "next";
import Link from "next/link";
import { NewsCard } from "@/components/news-card";
import { SubscribeForm } from "@/components/subscribe-form";
import { listPublicNews } from "@/lib/news";

export const metadata: Metadata = {
  title: "Berita",
  description: "Berita dan informasi terbaru sekolah.",
};

const PAGE_SIZE = 9;

export default async function BeritaPage({ searchParams }: PageProps<"/berita">) {
  const sp = await searchParams;
  const pageRaw = Number(typeof sp.halaman === "string" ? sp.halaman : "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const { items, total } = await listPublicNews(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-900">Berita Sekolah</h1>
      <p className="mt-2 text-slate-600">Berita dapat dibaca siapa saja tanpa perlu masuk.</p>

      {items.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => <NewsCard key={n.id} news={n} />)}
        </div>
      ) : (
        <p className="mt-8 text-slate-600">Belum ada berita yang diterbitkan.</p>
      )}

      {lastPage > 1 && (
        <nav aria-label="Halaman berita" className="mt-8 flex items-center justify-center gap-4 text-sm">
          {page > 1 && <Link href={`/berita?halaman=${page - 1}`} className="btn-secondary">← Sebelumnya</Link>}
          <span className="text-slate-600">Halaman {page} dari {lastPage}</span>
          {page < lastPage && <Link href={`/berita?halaman=${page + 1}`} className="btn-secondary">Berikutnya →</Link>}
        </nav>
      )}

      <div className="mx-auto mt-12 max-w-3xl">
        <SubscribeForm source="halaman_berita" />
      </div>
    </div>
  );
}
