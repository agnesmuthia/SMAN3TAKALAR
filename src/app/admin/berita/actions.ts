"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { newsActionContext } from "@/lib/auth/dal";
import { htmlToText, sanitizeNewsHtml } from "@/lib/cms/sanitize";
import { newsImagePrefix, uploadNewsImage } from "@/lib/cms/storage";
import { parseTagInput } from "@/lib/cms/tags";
import { allowedIntents, targetStatus, type NewsIntent, type NewsStatus } from "@/lib/cms/workflow";
import { handleNewsPublished } from "@/lib/newsletter/service";
import { slugify } from "@/lib/slug";
import type { ActionFormState } from "@/components/action-form";

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });

const INTENT_MESSAGE: Record<NewsIntent, string> = {
  save: "Perubahan disimpan.",
  submit: "Berita dikirim untuk persetujuan.",
  publish: "Berita diterbitkan.",
  return: "Berita dikembalikan ke penulis dengan catatan.",
  archive: "Berita diarsipkan dan tidak lagi tampil di website.",
  restore: "Berita dipulihkan sebagai draf.",
};

// Input datetime-local dibaca sebagai WITA (UTC+8).
function parseWita(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const schema = z.object({
  id: z.uuid().optional(),
  intent: z.enum(["save", "submit", "publish", "return", "archive", "restore"]),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200, "Judul maksimal 200 karakter."),
  slug: z.string().trim().max(120).optional(),
  excerpt: z.string().trim().max(400, "Ringkasan maksimal 400 karakter."),
  contentHtml: z.string().max(200_000, "Isi berita terlalu panjang."),
  coverImageUrl: z.string().trim().max(1000),
  removeCover: z.boolean(),
  categoryId: z.union([z.uuid(), z.literal("")]),
  tags: z.string().max(500),
  visibility: z.enum(["public", "internal"]),
  newsletterEligible: z.boolean(),
  publishAt: z.string().trim(),
  reviewNote: z.string().trim().max(1000),
});

export async function saveNewsAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await newsActionContext();
  if (!ctx) return fail("Akses ditolak. Akun Anda tidak memiliki izin menulis berita.");

  const parsed = schema.safeParse({
    id: formData.get("id") || undefined,
    intent: formData.get("intent") ?? "save",
    title: formData.get("title") ?? "",
    slug: formData.get("slug") || undefined,
    excerpt: formData.get("excerpt") ?? "",
    contentHtml: formData.get("contentHtml") ?? "",
    coverImageUrl: formData.get("coverImageUrl") ?? "",
    removeCover: formData.get("removeCover") === "on",
    categoryId: formData.get("categoryId") ?? "",
    tags: formData.get("tags") ?? "",
    visibility: formData.get("visibility") ?? "public",
    newsletterEligible: formData.get("newsletterEligible") === "on",
    publishAt: formData.get("publishAt") ?? "",
    reviewNote: formData.get("reviewNote") ?? "",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;

  // Data lama (dibaca lewat RLS: editor hanya melihat miliknya).
  type Existing = { status: NewsStatus; author_id: string | null; published_at: string | null; cover_image_url: string | null; slug: string };
  let existing: Existing | null = null;
  if (v.id) {
    const { data } = await ctx.supabase
      .from("news")
      .select("status, author_id, published_at, cover_image_url, slug")
      .eq("id", v.id)
      .maybeSingle<Existing>();
    if (!data) return fail("Berita tidak ditemukan atau Anda tidak berhak mengubahnya.");
    existing = data;
  }

  const isAuthor = !existing || existing.author_id === ctx.user.id;
  const allowed = allowedIntents(ctx.access, existing?.status ?? null, isAuthor);
  if (!allowed.includes(v.intent)) return fail("Tindakan ini tidak diizinkan untuk peran atau status berita saat ini.");

  // Arsip/pulihkan tidak mengubah isi.
  if (v.intent === "archive" || v.intent === "restore") {
    const { error } = await ctx.supabase.from("news").update({ status: targetStatus(v.intent, existing!.status) }).eq("id", v.id!);
    if (error) return fail("Status berita gagal diubah.");
    revalidateNews(existing!.slug);
    return ok(INTENT_MESSAGE[v.intent]);
  }

  if ((v.intent === "submit" || v.intent === "publish") && !v.excerpt) {
    return fail("Ringkasan wajib diisi sebelum berita dikirim atau diterbitkan.");
  }
  if (v.intent === "return" && !v.reviewNote) return fail("Tulis catatan untuk penulis.");

  const prefix = newsImagePrefix();
  const contentHtml = sanitizeNewsHtml(v.contentHtml, { imagePrefix: prefix });
  const content = htmlToText(contentHtml);
  if ((v.intent === "submit" || v.intent === "publish") && content.length < 20) {
    return fail("Isi berita terlalu pendek untuk dikirim atau diterbitkan.");
  }

  // Gambar utama: unggahan baru, tetap, atau dihapus.
  let cover: string | null = existing?.cover_image_url ?? null;
  const file = formData.get("coverFile");
  if (file instanceof File && file.size > 0) {
    const upload = await uploadNewsImage(file);
    if (!upload.ok) return fail(upload.error);
    cover = upload.url;
  } else if (v.removeCover) {
    cover = null;
  } else if (v.coverImageUrl && v.coverImageUrl !== existing?.cover_image_url) {
    if (!prefix || !v.coverImageUrl.startsWith(prefix)) return fail("Gambar utama harus diunggah melalui formulir ini.");
    cover = v.coverImageUrl;
  }

  const status = targetStatus(v.intent, existing?.status ?? null);
  let publishedAt = existing?.published_at ?? null;
  if (v.intent === "publish") {
    const scheduled = v.publishAt ? parseWita(v.publishAt) : null;
    if (v.publishAt && !scheduled) return fail("Format tanggal terbit tidak valid.");
    publishedAt = (scheduled ?? new Date()).toISOString();
  } else if (status === "published" && v.publishAt && ctx.access.canPublish) {
    const scheduled = parseWita(v.publishAt);
    if (!scheduled) return fail("Format tanggal terbit tidak valid.");
    publishedAt = scheduled.toISOString();
  }

  const slug = slugify(v.slug || v.title);
  if (!slug) return fail("Slug tidak valid. Gunakan huruf dan angka.");

  const row: Record<string, unknown> = {
    title: v.title,
    slug,
    excerpt: v.excerpt,
    content,
    content_html: contentHtml,
    cover_image_url: cover,
    category_id: v.categoryId || null,
    visibility: v.visibility,
    newsletter_eligible: v.newsletterEligible,
    status,
    published_at: publishedAt,
  };
  if (v.intent === "return") row.review_note = v.reviewNote;

  const result = existing
    ? await ctx.supabase.from("news").update(row).eq("id", v.id!).select("id").single<{ id: string }>()
    : await ctx.supabase.from("news").insert({ ...row, author_id: ctx.user.id }).select("id").single<{ id: string }>();
  if (result.error || !result.data) {
    if (result.error?.code === "23505") return fail("Slug sudah dipakai berita lain. Ubah slug atau judul.");
    if (result.error?.code === "42501") return fail("Anda tidak berhak melakukan perubahan ini.");
    console.error("[cms] simpan berita gagal:", result.error?.code, result.error?.message);
    return fail("Berita gagal disimpan.");
  }
  const newsId = result.data.id;

  const tagError = await syncTags(ctx.supabase, newsId, v.tags);

  let notice = "";
  if (status === "published" && existing?.status !== "published" && publishedAt && new Date(publishedAt) <= new Date()) {
    const autoError = await handleNewsPublished(newsId, ctx.user.id);
    if (autoError) notice = ` ${autoError}`;
  }

  revalidateNews(slug, existing?.slug);
  if (!existing) redirect(`/admin/berita/${newsId}?disimpan=${v.intent}`);
  return ok(`${INTENT_MESSAGE[v.intent]}${tagError ? ` ${tagError}` : ""}${notice}`);
}

async function syncTags(
  supabase: NonNullable<Awaited<ReturnType<typeof newsActionContext>>>["supabase"],
  newsId: string,
  raw: string,
): Promise<string | null> {
  const tags = parseTagInput(raw);
  if (tags.length) {
    await supabase.from("news_tags").upsert(tags, { onConflict: "slug", ignoreDuplicates: true });
  }
  const { data: tagRows } = tags.length
    ? await supabase.from("news_tags").select("id, slug").in("slug", tags.map((t) => t.slug))
    : { data: [] as { id: string; slug: string }[] };
  const wanted = new Set(((tagRows ?? []) as { id: string }[]).map((t) => t.id));

  const { data: current } = await supabase.from("news_tag_links").select("tag_id").eq("news_id", newsId);
  const have = new Set(((current ?? []) as { tag_id: string }[]).map((t) => t.tag_id));
  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id));

  if (toRemove.length) await supabase.from("news_tag_links").delete().eq("news_id", newsId).in("tag_id", toRemove);
  if (toAdd.length) {
    const { error } = await supabase.from("news_tag_links").insert(toAdd.map((tag_id) => ({ news_id: newsId, tag_id })));
    if (error) return "Sebagian tag tidak tersimpan.";
  }
  return null;
}

function revalidateNews(slug: string, oldSlug?: string) {
  revalidatePath("/");
  revalidatePath("/berita");
  revalidatePath(`/berita/${slug}`);
  if (oldSlug && oldSlug !== slug) revalidatePath(`/berita/${oldSlug}`);
  revalidatePath("/admin/berita");
  revalidatePath("/admin");
}

// Dipanggil langsung dari editor (tombol gambar) untuk menyisipkan gambar.
export async function uploadNewsImageAction(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await newsActionContext();
  if (!ctx) return { ok: false, error: "Akses ditolak." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Pilih file gambar." };
  return uploadNewsImage(file);
}

export async function restoreRevisionAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await newsActionContext();
  if (!ctx) return fail("Akses ditolak.");
  const revisionId = z.coerce.number().int().positive().safeParse(formData.get("revisionId"));
  if (!revisionId.success) return fail("Data tidak valid.");

  const { data: rev } = await ctx.supabase
    .from("news_revisions")
    .select("news_id, revision_no, title, excerpt, content, content_html, cover_image_url, category_id")
    .eq("id", revisionId.data)
    .maybeSingle<{ news_id: string; revision_no: number; title: string; excerpt: string; content: string; content_html: string | null; cover_image_url: string | null; category_id: string | null }>();
  if (!rev) return fail("Revisi tidak ditemukan.");

  // Isi dipulihkan; status tidak berubah. RLS menolak bila tidak berhak.
  const { data, error } = await ctx.supabase
    .from("news")
    .update({
      title: rev.title,
      excerpt: rev.excerpt,
      content: rev.content,
      content_html: rev.content_html ? sanitizeNewsHtml(rev.content_html, { imagePrefix: newsImagePrefix() }) : null,
      cover_image_url: rev.cover_image_url,
      category_id: rev.category_id,
    })
    .eq("id", rev.news_id)
    .select("slug");
  if (error || !data?.length) return fail("Revisi tidak dapat dipulihkan untuk status berita saat ini.");
  revalidateNews((data[0] as { slug: string }).slug);
  return ok(`Isi dari revisi #${rev.revision_no} dipulihkan.`);
}

export async function deleteNewsAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await newsActionContext();
  if (!ctx?.access.isSuperAdmin) return fail("Hanya Super Admin yang dapat menghapus permanen.");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  if (formData.get("confirm") !== "on") return fail("Centang konfirmasi terlebih dahulu.");
  const { error } = await ctx.supabase.from("news").delete().eq("id", id.data);
  if (error) return fail("Berita tidak dapat dihapus (mungkin sudah dipakai di kampanye buletin). Arsipkan saja.");
  revalidatePath("/berita");
  revalidatePath("/");
  redirect("/admin/berita?dihapus=1");
}

// -----------------------------------------------------------------------------
// Kategori (penerbit)
// -----------------------------------------------------------------------------

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter.").max(60),
  description: z.string().trim().max(300),
  position: z.coerce.number().int().min(0).max(999),
});

export async function saveCategoryAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await newsActionContext();
  if (!ctx?.access.canPublish) return fail("Akses ditolak.");
  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    position: formData.get("position") || 0,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;
  const row = { name: v.name, slug: slugify(v.name).slice(0, 60).replace(/-+$/g, ""), description: v.description || null, position: v.position };
  const { error } = v.id
    ? await ctx.supabase.from("news_categories").update(row).eq("id", v.id)
    : await ctx.supabase.from("news_categories").insert(row);
  if (error) return fail(error.code === "23505" ? "Kategori dengan nama serupa sudah ada." : "Kategori gagal disimpan.");
  revalidatePath("/admin/berita/kategori");
  revalidatePath("/berita");
  return ok("Kategori disimpan.");
}

export async function deleteCategoryAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await newsActionContext();
  if (!ctx?.access.canPublish) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  // Berita dalam kategori ini menjadi "tanpa kategori" (ON DELETE SET NULL).
  const { error } = await ctx.supabase.from("news_categories").delete().eq("id", id.data);
  if (error) return fail("Kategori gagal dihapus.");
  revalidatePath("/admin/berita/kategori");
  revalidatePath("/berita");
  return ok("Kategori dihapus. Berita di dalamnya menjadi tanpa kategori.");
}

