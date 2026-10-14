import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAlbumWithPhotos } from "@/lib/content/public";
import { formatTanggalSaja } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/galeri/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await getAlbumWithPhotos(slug);
  if (!result) return { title: "Album tidak ditemukan" };
  const image = result.album.cover?.image_url ?? result.photos[0]?.image_url;
  return {
    title: result.album.title,
    description: result.album.description || undefined,
    alternates: { canonical: `/galeri/${result.album.slug}` },
    openGraph: { title: result.album.title, images: image ? [image] : undefined },
  };
}

// Penampil foto tanpa JavaScript: setiap foto punya anchor #foto-N dan
// tampilan layar penuh memakai CSS :target (tombol tutup/sebelum/berikut).
export default async function AlbumPage({ params }: PageProps<"/galeri/[slug]">) {
  const { slug } = await params;
  const result = await getAlbumWithPhotos(slug);
  if (!result) notFound();
  const { album, photos } = result;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-teal-700">Beranda</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/galeri" className="hover:text-teal-700">Galeri</Link></li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-slate-700">{album.title}</li>
        </ol>
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{album.title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {album.event_date && <>{formatTanggalSaja(album.event_date)} · </>}{photos.length} foto
      </p>
      {album.description && <p className="mt-4 max-w-3xl whitespace-pre-line text-slate-700">{album.description}</p>}

      {photos.length === 0 ? (
        <p className="card mt-8 text-sm text-slate-600">Foto album ini belum tersedia.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id}>
              <a href={`#foto-${i + 1}`} className="block overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.caption || `Foto ${i + 1} dari ${album.title}`} loading="lazy" className="aspect-square w-full object-cover transition hover:scale-[1.03]" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {photos.map((p, i) => (
        <div key={p.id} id={`foto-${i + 1}`} className="lightbox" role="dialog" aria-label={`Foto ${i + 1} dari ${photos.length}`}>
          <a href="#" className="lightbox-backdrop" aria-label="Tutup" />
          <figure className="lightbox-figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_url} alt={p.caption || `Foto ${i + 1} dari ${album.title}`} loading="lazy" />
            <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
              <span>{p.caption}</span>
              <span className="flex gap-2">
                {i > 0 && <a href={`#foto-${i}`} className="btn-ghost-light !px-3 !py-1.5">← Sebelumnya</a>}
                {i < photos.length - 1 && <a href={`#foto-${i + 2}`} className="btn-ghost-light !px-3 !py-1.5">Berikutnya →</a>}
                <a href="#" className="btn-ghost-light !px-3 !py-1.5">Tutup ✕</a>
              </span>
            </figcaption>
          </figure>
        </div>
      ))}
    </div>
  );
}
