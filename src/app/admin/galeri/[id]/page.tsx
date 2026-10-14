import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { GalleryUploader } from "@/components/cms/gallery-uploader";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { deleteAlbumAction, deletePhotoAction, updatePhotoAction } from "../../konten/actions";
import { AlbumForm } from "../album-form";

export const metadata: Metadata = { title: "Album Galeri" };

type Album = { id: string; slug: string; title: string; description: string; event_date: string | null; is_published: boolean; consent_confirmed_at: string | null; cover_photo_id: string | null };

export default async function AlbumPage({ params, searchParams }: PageProps<"/admin/galeri/[id]">) {
  const { id } = await params;
  const ctx = await requireNewsPublisher(`/admin/galeri/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: album } = await ctx.supabase
    .from("gallery_albums")
    .select("id, slug, title, description, event_date, is_published, consent_confirmed_at, cover_photo_id")
    .eq("id", id)
    .maybeSingle<Album>();
  if (!album) notFound();
  const { data: photos } = await ctx.supabase.from("gallery_photos").select("id, image_url, caption, position").eq("album_id", id).order("position").order("created_at");
  const photoRows = (photos ?? []) as { id: string; image_url: string; caption: string; position: number }[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/galeri" className="text-sm text-teal-700 hover:underline">← Galeri</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">{album.title}</h1>
        </div>
        {album.is_published && <Link href={`/galeri/${album.slug}`} target="_blank" className="btn-secondary">Lihat di website ↗</Link>}
      </div>
      {sp.baru === "1" && <Alert tone="success">Album dibuat. Sekarang unggah fotonya.</Alert>}

      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Foto ({photoRows.length})</h2>
        <GalleryUploader albumId={album.id} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photoRows.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url} alt={p.caption} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-2 p-3">
                {album.cover_photo_id === p.id && <span className="rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-semibold text-navy-900">Sampul album</span>}
                <ActionForm action={updatePhotoAction} submitLabel="Simpan" className="space-y-2" submitClassName="btn-secondary !px-2 !py-1 text-xs">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="albumId" value={album.id} />
                  <label className="sr-only" htmlFor={`c-${p.id}`}>Keterangan foto</label>
                  <input id={`c-${p.id}`} name="caption" defaultValue={p.caption} maxLength={300} placeholder="Keterangan foto" className="input" />
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1">Urutan <input name="position" type="number" min={0} max={9999} defaultValue={p.position} className="input !w-20 !py-1" /></label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="makeCover" /> Jadikan sampul</label>
                  </div>
                </ActionForm>
                <ActionForm action={deletePhotoAction} submitLabel="Hapus foto" className="" submitClassName="text-xs font-semibold text-red-700 hover:underline">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="albumId" value={album.id} />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Informasi album</h2>
        <AlbumForm
          values={{
            id: album.id,
            title: album.title,
            slug: album.slug,
            description: album.description,
            eventDate: album.event_date ?? "",
            isPublished: album.is_published,
            consentConfirmed: Boolean(album.consent_confirmed_at),
          }}
        />
      </section>

      <section className="card">
        <h2 className="font-semibold text-red-800">Hapus album</h2>
        <ActionForm action={deleteAlbumAction} submitLabel="Hapus album beserta daftar fotonya" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
          <input type="hidden" name="id" value={album.id} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin</label>
        </ActionForm>
      </section>
    </div>
  );
}
