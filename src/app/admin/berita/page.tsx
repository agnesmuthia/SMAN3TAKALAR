import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { requireNewsWriter } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { DISPLAY_STATUS_LABEL, DISPLAY_STATUS_STYLE, displayStatus } from "@/lib/cms/workflow";
import { formatWaktuWita } from "@/lib/cms/time";
import { normalizeSearch, pageHref, parsePage } from "@/lib/news-utils";

export const metadata: Metadata = { title: "Manajemen Berita" };

const PER_PAGE = 20;
const STATUS_FILTERS = ["draft", "review", "scheduled", "published", "archived"] as const;

type Row = {
  id: string;
  title: string;
  status: string;
  visibility: string;
  published_at: string | null;
  updated_at: string;
  author_id: string | null;
  review_note: string | null;
  category: { name: string } | null;
};

export default async function AdminBeritaPage({ searchParams }: PageProps<"/admin/berita">) {
  const ctx = await requireNewsWriter("/admin/berita");
  const sp = await searchParams;
  const q = normalizeSearch(sp.q);
  const status = typeof sp.status === "string" && (STATUS_FILTERS as readonly string[]).includes(sp.status) ? sp.status : "";
  const kategori = typeof sp.kategori === "string" && /^[0-9a-f-]{36}$/.test(sp.kategori) ? sp.kategori : "";
  const page = parsePage(sp.halaman);
  const nowIso = new Date().toISOString();

  // RLS: penerbit melihat semua, editor hanya miliknya.
  let query = ctx.supabase
    .from("news")
    .select("id, title, status, visibility, published_at, updated_at, author_id, review_note, category:category_id (name)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (q) query = query.ilike("title", `%${q}%`);
  if (kategori) query = query.eq("category_id", kategori);
  if (status === "scheduled") query = query.eq("status", "published").gt("published_at", nowIso);
  else if (status === "published") query = query.eq("status", "published").lte("published_at", nowIso);
  else if (status) query = query.eq("status", status);

  const [{ data, count }, { data: cats }] = await Promise.all([
    query,
    ctx.supabase.from("news_categories").select("id, name").order("position"),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const categories = (cats ?? []) as { id: string; name: string }[];

  // Nama penulis (hanya nama) dibaca dengan service role setelah cek akses CMS.
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((x): x is string => Boolean(x)))];
  const { data: authors } = authorIds.length
    ? await createAdminClient().from("profiles").select("id, full_name").in("id", authorIds)
    : { data: [] };
  const authorName = new Map(((authors ?? []) as { id: string; full_name: string | null }[]).map((a) => [a.id, a.full_name ?? "—"]));
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Manajemen Berita</h1>
          <p className="text-sm text-slate-600">
            {ctx.access.canPublish ? "Anda dapat menerbitkan dan menyetujui berita." : "Anda dapat menulis berita dan mengirimnya untuk persetujuan."}
          </p>
        </div>
        <div className="flex gap-2">
          {ctx.access.canPublish && <Link href="/admin/berita/kategori" className="btn-secondary">Kategori</Link>}
          <Link href="/admin/berita/baru" className="btn-primary">+ Tambah Berita</Link>
        </div>
      </div>
      {sp.dihapus === "1" && <Alert tone="success">Berita dihapus permanen.</Alert>}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="label">Cari judul</label>
          <input id="q" name="q" type="search" defaultValue={q} className="input" />
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">Semua</option>
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{DISPLAY_STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="kategori" className="label">Kategori</label>
          <select id="kategori" name="kategori" defaultValue={kategori} className="input">
            <option value="">Semua</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-secondary">Terapkan</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">Judul</th>
              <th className="px-4 py-2">Kategori</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Penulis</th>
              <th className="px-4 py-2">Diperbarui</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const ds = displayStatus(n.status, n.published_at);
              return (
                <tr key={n.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/berita/${n.id}`} className="font-medium text-teal-700 hover:underline">{n.title}</Link>
                    {n.visibility === "internal" && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">Internal</span>}
                    {n.status === "draft" && n.review_note && <p className="mt-1 text-xs text-amber-800">Dikembalikan: {n.review_note}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{n.category?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DISPLAY_STATUS_STYLE[ds]}`}>{DISPLAY_STATUS_LABEL[ds]}</span>
                    {ds === "scheduled" && n.published_at && <p className="mt-1 text-xs text-slate-500">{formatWaktuWita(n.published_at)}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{n.author_id ? authorName.get(n.author_id) ?? "—" : "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatWaktuWita(n.updated_at)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Tidak ada berita.</td></tr>}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <nav aria-label="Halaman" className="flex items-center gap-3 text-sm">
          {page > 1 && <Link href={pageHref("/admin/berita", { q, status, kategori, halaman: page - 1 })} className="btn-secondary">← Sebelumnya</Link>}
          <span className="text-slate-600">Halaman {page} dari {lastPage} · {total} berita</span>
          {page < lastPage && <Link href={pageHref("/admin/berita", { q, status, kategori, halaman: page + 1 })} className="btn-secondary">Berikutnya →</Link>}
        </nav>
      )}
    </div>
  );
}
