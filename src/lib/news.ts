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
  cover_image_url: string | null;
  published_at: string;
};

const PUBLIC_COLUMNS = "id, slug, title, excerpt, content, cover_image_url, published_at";

// Hanya berita TERBIT dan PUBLIK. Filter eksplisit ini sengaja digandakan
// dengan RLS agar pengguna yang sedang login (mis. guru) tetap melihat
// halaman publik yang sama dengan pengunjung tanpa login.
export async function listPublicNews(
  limit = 12,
  offset = 0,
  search = "",
): Promise<{ items: PublicNews[]; total: number }> {
  await connection();
  if (!isSupabaseConfigured()) return { items: [], total: 0 };
  const supabase = await createClient();
  let query = supabase
    .from("news")
    .select(PUBLIC_COLUMNS, { count: "exact" })
    .eq("status", "published")
    .eq("visibility", "public")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  // `search` sudah dinormalisasi (normalizeSearch) sehingga aman di filter or().
  if (search) query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
  const { data, count, error } = await query;
  if (error) {
    console.error("[berita] gagal memuat daftar:", error.message);
    return { items: [], total: 0 };
  }
  return { items: (data ?? []) as PublicNews[], total: count ?? 0 };
}

export async function listRelatedNews(excludeId: string, limit = 3): Promise<PublicNews[]> {
  await connection();
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("news")
    .select(PUBLIC_COLUMNS)
    .eq("status", "published")
    .eq("visibility", "public")
    .lte("published_at", new Date().toISOString())
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PublicNews[];
}

export async function getPublicNewsBySlug(slug: string): Promise<PublicNews | null> {
  await connection();
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("news")
    .select(PUBLIC_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .lte("published_at", new Date().toISOString())
    .maybeSingle<PublicNews>();
  return data ?? null;
}
