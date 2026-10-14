import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/page-hero";
import { Pager } from "@/components/pager";
import { firstPhotoByAlbum, listAlbums } from "@/lib/content/public";
import { parsePage } from "@/lib/news-utils";
import { formatTanggalSaja } from "@/lib/site";

export const metadata: Metadata = { title: "Galeri", description: "Dokumentasi foto kegiatan sekolah." };

const PAGE_SIZE = 12;

export default async function GaleriPage({ searchParams }: PageProps<"/galeri">) {
  const sp = await searchParams;
  const page = parsePage(sp.halaman);
  const { items, total } = await listAlbums(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const fallback = await firstPhotoByAlbum(items.filter((a) => !a.cover).map((a) => a.id));
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div>
      <PageHero eyebrow="Dokumentasi" title="Galeri kegiatan" description="Foto kegiatan sekolah yang telah dipastikan boleh dipublikasikan." />
      <div className="mx-auto max-w-6xl px-4 py-12">
        {items.length === 0 ? (
          <EmptyState title="Belum ada album galeri." text="Album foto kegiatan akan tampil di sini setelah diterbitkan." />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => {
              const cover = a.cover?.image_url ?? fallback.get(a.id) ?? null;
              return (
                <li key={a.id}>
                  <Link href={`/galeri/${a.slug}`} className="group card card-hover block overflow-hidden !p-0">
                    <div className="aspect-[4/3] bg-slate-100">
                      {cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                      )}
                    </div>
                    <div className="p-4">
                      {a.event_date && <p className="text-xs text-slate-500">{formatTanggalSaja(a.event_date)}</p>}
                      <h2 className="mt-1 font-bold text-navy-900">{a.title}</h2>
                      {a.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.description}</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pager base="/galeri" params={{}} page={page} lastPage={lastPage} />
      </div>
    </div>
  );
}
