import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type PublicNews = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  content_html?: string | null;
  cover_image_url: string | null;
  published_at: string;
  category: { name: string; slug: string } | null;
};

export type Category = { id: string; name: string; slug: string };
export type Tag = { id: string; name: string; slug: string };

const LIST_COLUMNS = "id, slug, title, excerpt, content, cover_image_url, published_at, category:category_id (name, slug)";
const DETAIL_COLUMNS = `${LIST_COLUMNS}, content_html`;

async function db() {
  await connection();
  if (!isSupabaseConfigured()) return null;
  return createClient();
}

// Hanya berita TERBIT dan PUBLIK yang waktunya sudah tiba. Filter ini sengaja
// digandakan dengan RLS agar pengguna yang login (mis. guru) melihat halaman
// publik yang sama dengan pengunjung.
export async function listPublicNews(
  limit = 12,
  offset = 0,
  filter: { search?: string; categoryId?: string; newsIds?: string[] } = {},
): Promise<{ items: PublicNews[]; total: number }> {
  const supabase = await db();
  if (!supabase) return { items: [], total: 0 };
  if (filter.newsIds && filter.newsIds.length === 0) return { items: [], total: 0 };
  let query = supabase
    .from("news")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .eq("visibility", "public")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  // `search` sudah dinormalisasi (normalizeSearch) sehingga aman di filter or().
  if (filter.search) query = query.or(`title.ilike.%${filter.search}%,excerpt.ilike.%${filter.search}%`);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.newsIds) query = query.in("id", filter.newsIds.slice(0, 500));
  const { data, count, error } = await query;
  if (error) {
    console.error("[berita] gagal memuat daftar:", error.message);
    return { items: [], total: 0 };
  }
  return { items: (data ?? []) as unknown as PublicNews[], total: count ?? 0 };
}

export async function listRelatedNews(excludeId: string, categoryId: string | null, limit = 3): Promise<PublicNews[]> {
  const supabase = await db();
  if (!supabase) return [];
  const base = () =>
    supabase
      .from("news")
      .select(LIST_COLUMNS)
      .eq("status", "published")
      .eq("visibility", "public")
      .lte("published_at", new Date().toISOString())
      .neq("id", excludeId)
      .order("published_at", { ascending: false })
      .limit(limit);
  const sameCategory = categoryId ? ((await base().eq("category_id", categoryId)).data ?? []) : [];
  if (sameCategory.length >= limit) return sameCategory as unknown as PublicNews[];
  const latest = ((await base()).data ?? []) as unknown as PublicNews[];
  const seen = new Set((sameCategory as unknown as PublicNews[]).map((n) => n.id));
  return [...(sameCategory as unknown as PublicNews[]), ...latest.filter((n) => !seen.has(n.id))].slice(0, limit);
}

export async function getPublicNewsBySlug(slug: string): Promise<(PublicNews & { category_id: string | null }) | null> {
  const supabase = await db();
  if (!supabase || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const { data } = await supabase
    .from("news")
    .select(`${DETAIL_COLUMNS}, category_id`)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  return (data as unknown as PublicNews & { category_id: string | null }) ?? null;
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("news_categories").select("id, name, slug").order("position");
  return (data ?? []) as Category[];
}

export async function getTagBySlug(slug: string): Promise<Tag | null> {
  const supabase = await db();
  if (!supabase || !/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const { data } = await supabase.from("news_tags").select("id, name, slug").eq("slug", slug).maybeSingle<Tag>();
  return data ?? null;
}

// RLS tautan tag hanya mengembalikan berita yang terlihat publik.
export async function newsIdsForTag(tagId: string): Promise<string[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("news_tag_links").select("news_id").eq("tag_id", tagId).limit(500);
  return ((data ?? []) as { news_id: string }[]).map((r) => r.news_id);
}

export async function tagsForNews(newsId: string): Promise<Tag[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("news_tag_links").select("tag:tag_id (id, name, slug)").eq("news_id", newsId);
  return ((data ?? []) as unknown as { tag: Tag | null }[]).map((r) => r.tag).filter((t): t is Tag => Boolean(t));
}
