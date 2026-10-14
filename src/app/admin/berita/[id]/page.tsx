import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Alert } from "@/components/alert";
import { NewsEditorForm } from "@/components/cms/news-editor-form";
import { requireNewsWriter } from "@/lib/auth/dal";
import { legacyTextToHtml } from "@/lib/cms/sanitize";
import { formatWaktuWita, toWitaInput } from "@/lib/cms/time";
import { DISPLAY_STATUS_LABEL, DISPLAY_STATUS_STYLE, allowedIntents, displayStatus, type NewsStatus } from "@/lib/cms/workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteNewsAction, restoreRevisionAction } from "../actions";

export const metadata: Metadata = { title: "Ubah Berita" };

type News = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  content_html: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  visibility: "public" | "internal";
  newsletter_eligible: boolean;
  status: NewsStatus;
  published_at: string | null;
  author_id: string | null;
  review_note: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

const SAVED_MESSAGE: Record<string, string> = {
  save: "Draf tersimpan.",
  submit: "Berita dikirim untuk persetujuan.",
  publish: "Berita diterbitkan.",
};

export default async function UbahBeritaPage({ params, searchParams }: PageProps<"/admin/berita/[id]">) {
  const { id } = await params;
  const ctx = await requireNewsWriter(`/admin/berita/${id}`);
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  // RLS: editor hanya menemukan berita miliknya.
  const { data: news } = await ctx.supabase
    .from("news")
    .select("id, slug, title, excerpt, content, content_html, cover_image_url, category_id, visibility, newsletter_eligible, status, published_at, author_id, review_note, submitted_at, approved_at")
    .eq("id", id)
    .maybeSingle<News>();
  if (!news) notFound();

  const [{ data: cats }, { data: tagLinks }, { data: revisions }] = await Promise.all([
    ctx.supabase.from("news_categories").select("id, name").order("position"),
    ctx.supabase.from("news_tag_links").select("tag:tag_id (name)").eq("news_id", id),
    ctx.supabase.from("news_revisions").select("id, revision_no, title, status, edited_by, created_at").eq("news_id", id).order("revision_no", { ascending: false }).limit(30),
  ]);
  const revRows = (revisions ?? []) as { id: number; revision_no: number; title: string; status: string; edited_by: string | null; created_at: string }[];
  const editorIds = [...new Set(revRows.map((r) => r.edited_by).filter((x): x is string => Boolean(x)))];
  const { data: editors } = editorIds.length
    ? await createAdminClient().from("profiles").select("id, full_name").in("id", editorIds)
    : { data: [] };
  const editorName = new Map(((editors ?? []) as { id: string; full_name: string | null }[]).map((e) => [e.id, e.full_name ?? "—"]));

  const isAuthor = news.author_id === ctx.user.id;
  const intents = allowedIntents(ctx.access, news.status, isAuthor);
  const ds = displayStatus(news.status, news.published_at);
  const tags = ((tagLinks ?? []) as unknown as { tag: { name: string } | null }[]).map((t) => t.tag?.name).filter(Boolean).join(", ");
  const canRestoreRevision = intents.includes("save");
  const saved = typeof sp.disimpan === "string" ? SAVED_MESSAGE[sp.disimpan] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/berita" className="text-sm text-teal-700 hover:underline">← Manajemen Berita</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Ubah Berita</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${DISPLAY_STATUS_STYLE[ds]}`}>{DISPLAY_STATUS_LABEL[ds]}</span>
          <Link href={`/admin/berita/${news.id}/pratinjau`} className="btn-secondary" target="_blank">Pratinjau ↗</Link>
          {ds === "published" && news.visibility === "public" && (
            <Link href={`/berita/${news.slug}`} className="btn-secondary" target="_blank">Lihat di website ↗</Link>
          )}
        </div>
      </div>

      {saved && <Alert tone="success">{saved}</Alert>}
      {news.status === "draft" && news.review_note && (
        <Alert tone="warning">Dikembalikan oleh penyetuju: {news.review_note}</Alert>
      )}
      {news.status === "review" && news.submitted_at && (
        <Alert tone="info">Menunggu persetujuan sejak {formatWaktuWita(news.submitted_at)}.</Alert>
      )}
      {ds === "scheduled" && news.published_at && (
        <Alert tone="info">Terjadwal tampil otomatis pada {formatWaktuWita(news.published_at)}.</Alert>
      )}

      <NewsEditorForm
        values={{
          id: news.id,
          title: news.title,
          slug: news.slug,
          excerpt: news.excerpt,
          contentHtml: news.content_html ?? legacyTextToHtml(news.content),
          coverImageUrl: news.cover_image_url,
          categoryId: news.category_id,
          tags,
          visibility: news.visibility,
          newsletterEligible: news.newsletter_eligible,
          publishAtLocal: toWitaInput(news.published_at),
        }}
        categories={(cats ?? []) as { id: string; name: string }[]}
        intents={intents}
        canPublish={ctx.access.canPublish}
        isPublished={news.status === "published"}
      />

      <section className="card">
        <h2 className="font-semibold text-navy-900">Riwayat perubahan</h2>
        <p className="mt-1 text-sm text-slate-600">Setiap penyimpanan tercatat otomatis. Memulihkan revisi hanya mengembalikan isi, bukan status.</p>
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {revRows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong>#{r.revision_no}</strong> · {formatWaktuWita(r.created_at)} · {r.edited_by ? editorName.get(r.edited_by) ?? "—" : "Sistem"} ·{" "}
                <span className="text-slate-500">{DISPLAY_STATUS_LABEL[displayStatus(r.status, null)]}</span>
                <span className="block text-slate-500">{r.title}</span>
              </span>
              {canRestoreRevision && r.revision_no !== revRows[0]?.revision_no && (
                <ActionForm action={restoreRevisionAction} submitLabel="Pulihkan isi" className="" submitClassName="text-xs font-semibold text-teal-700 hover:underline">
                  <input type="hidden" name="revisionId" value={r.id} />
                </ActionForm>
              )}
            </li>
          ))}
          {revRows.length === 0 && <li className="py-2 text-slate-500">Belum ada riwayat.</li>}
        </ul>
      </section>

      {ctx.access.isSuperAdmin && (
        <section className="card">
          <h2 className="font-semibold text-red-800">Hapus permanen (Super Admin)</h2>
          <p className="mt-1 text-sm text-slate-600">Tidak dapat dibatalkan. Untuk menyembunyikan berita, gunakan &quot;Arsipkan&quot;.</p>
          <ActionForm action={deleteNewsAction} submitLabel="Hapus permanen" className="mt-3 flex flex-wrap items-center gap-3" submitClassName="btn-danger">
            <input type="hidden" name="id" value={news.id} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Saya yakin</label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
