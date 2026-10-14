import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Pager } from "@/components/pager";
import { listPublicAnnouncements } from "@/lib/content/public";
import { parsePage } from "@/lib/news-utils";
import { formatTanggal } from "@/lib/site";

export const metadata: Metadata = { title: "Pengumuman", description: "Pengumuman resmi sekolah untuk masyarakat umum." };

const PAGE_SIZE = 15;

export default async function PengumumanPage({ searchParams }: PageProps<"/pengumuman">) {
  const sp = await searchParams;
  const page = parsePage(sp.halaman);
  const { items, total } = await listPublicAnnouncements(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div>
      <PageHero eyebrow="Informasi resmi" title="Pengumuman" description="Pengumuman sekolah untuk siswa, orang tua, dan masyarakat umum.">
        <p className="mt-3 text-sm text-slate-500">
          Pengumuman khusus guru atau siswa tersedia di <Link href="/masuk" className="font-semibold text-teal-700 hover:underline">dashboard warga sekolah</Link>.
        </p>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-12">
        {items.length === 0 ? (
          <EmptyState title="Belum ada pengumuman publik." text="Pengumuman resmi akan tampil di sini setelah diterbitkan." />
        ) : (
          <ul className="space-y-4">
            {items.map((a) => (
              <li key={a.id} id={`p-${a.id}`} className="card scroll-mt-24">
                <time dateTime={a.published_at} className="text-xs text-slate-500">{formatTanggal(a.published_at)}</time>
                <h2 className="mt-1 text-lg font-bold text-navy-900">{a.title}</h2>
                {a.body && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{a.body}</p>}
              </li>
            ))}
          </ul>
        )}
        <Pager base="/pengumuman" params={{}} page={page} lastPage={lastPage} />
      </div>
    </div>
  );
}
