import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { ImageField, PublishedBadge } from "@/components/cms/image-field";
import { requireNewsPublisher } from "@/lib/auth/dal";
import { deleteProgramAction, saveProgramAction } from "../konten/actions";

export const metadata: Metadata = { title: "Program Unggulan" };

type Program = { id: string; title: string; summary: string; image_url: string | null; page_id: string | null; position: number; is_published: boolean };

function ProgramFields({ p, pages }: { p?: Program; pages: { id: string; title: string }[] }) {
  const k = p?.id ?? "baru";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <div><label className="label" htmlFor={`t-${k}`}>Nama program</label><input id={`t-${k}`} name="title" required minLength={2} maxLength={100} defaultValue={p?.title} className="input" /></div>
        <div><label className="label" htmlFor={`s-${k}`}>Deskripsi singkat</label><textarea id={`s-${k}`} name="summary" rows={3} maxLength={400} defaultValue={p?.summary} className="input" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`pg-${k}`}>Halaman detail (opsional)</label>
            <select id={`pg-${k}`} name="pageId" defaultValue={p?.page_id ?? ""} className="input">
              <option value="">Tidak ada</option>
              {pages.map((pg) => <option key={pg.id} value={pg.id}>{pg.title}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor={`o-${k}`}>Urutan</label><input id={`o-${k}`} name="position" type="number" min={0} max={999} defaultValue={p?.position ?? 0} className="input" /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublished" defaultChecked={p?.is_published ?? false} /> Tampilkan di beranda</label>
      </div>
      <ImageField label="Gambar program (opsional)" current={p?.image_url ?? null} />
    </div>
  );
}

export default async function ProgramPage() {
  const ctx = await requireNewsPublisher("/admin/program");
  const [{ data }, { data: pages }] = await Promise.all([
    ctx.supabase.from("school_programs").select("id, title, summary, image_url, page_id, position, is_published").order("position"),
    ctx.supabase.from("site_pages").select("id, title").order("title"),
  ]);
  const rows = (data ?? []) as Program[];
  const pageRows = (pages ?? []) as { id: string; title: string }[];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Program Unggulan</h1>
        <p className="text-sm text-slate-600">Ditampilkan sebagai kartu di beranda. Tautkan ke halaman detail bila ada.</p>
      </div>
      <section className="card space-y-4">
        <h2 className="font-semibold text-navy-900">Tambah program</h2>
        <ActionForm action={saveProgramAction} submitLabel="Tambah program" submitClassName="btn-primary">
          <ProgramFields pages={pageRows} />
        </ActionForm>
      </section>
      {rows.map((p) => (
        <section key={p.id} className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-navy-900">{p.title}</h2>
            <PublishedBadge published={p.is_published} />
          </div>
          <ActionForm action={saveProgramAction} submitLabel="Simpan" submitClassName="btn-secondary">
            <input type="hidden" name="id" value={p.id} />
            <ProgramFields p={p} pages={pageRows} />
          </ActionForm>
          <ActionForm action={deleteProgramAction} submitLabel="Hapus program" className="" submitClassName="text-xs font-semibold text-red-700 hover:underline">
            <input type="hidden" name="id" value={p.id} />
          </ActionForm>
        </section>
      ))}
    </div>
  );
}
