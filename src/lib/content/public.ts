import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { CalendarEvent } from "./calendar";
import type { AchievementLevel } from "./labels";

// Semua kueri memakai sesi pemanggil: RLS hanya mengembalikan konten yang
// diterbitkan (dan kegiatan internal hanya untuk anggota aktif).

async function db() {
  await connection();
  return isSupabaseConfigured() ? createClient() : null;
}

export type SitePage = { id: string; slug: string; title: string; summary: string; content: string; content_html: string | null; updated_at: string };
export type Program = { id: string; title: string; summary: string; image_url: string | null; page: { slug: string } | null };
export type Album = { id: string; slug: string; title: string; description: string; event_date: string | null; cover: { image_url: string } | null };
export type Photo = { id: string; image_url: string; caption: string };
export type Achievement = {
  id: string; title: string; recipient: string | null; level: AchievementLevel; organizer: string | null;
  achieved_on: string; description: string; image_url: string | null; news: { slug: string } | null;
};
export type PublicAnnouncement = { id: string; title: string; body: string; published_at: string };

export async function listPublishedPages(): Promise<Pick<SitePage, "id" | "slug" | "title" | "summary">[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("site_pages").select("id, slug, title, summary").eq("is_published", true).order("position").order("title");
  return (data ?? []) as Pick<SitePage, "id" | "slug" | "title" | "summary">[];
}

export async function getPublishedPage(slug: string): Promise<SitePage | null> {
  const supabase = await db();
  if (!supabase || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { data } = await supabase
    .from("site_pages")
    .select("id, slug, title, summary, content, content_html, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle<SitePage>();
  return data ?? null;
}

export async function listPrograms(): Promise<Program[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("school_programs")
    .select("id, title, summary, image_url, page:page_id (slug)")
    .eq("is_published", true)
    .order("position");
  return (data ?? []) as unknown as Program[];
}

export async function listAlbums(limit = 24, offset = 0): Promise<{ items: Album[]; total: number }> {
  const supabase = await db();
  if (!supabase) return { items: [], total: 0 };
  const { data, count } = await supabase
    .from("gallery_albums")
    .select("id, slug, title, description, event_date, cover:cover_photo_id (image_url)", { count: "exact" })
    .eq("is_published", true)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return { items: (data ?? []) as unknown as Album[], total: count ?? 0 };
}

export async function getAlbumWithPhotos(slug: string): Promise<{ album: Album; photos: Photo[] } | null> {
  const supabase = await db();
  if (!supabase || !/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const { data: album } = await supabase
    .from("gallery_albums")
    .select("id, slug, title, description, event_date, cover:cover_photo_id (image_url)")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!album) return null;
  const { data: photos } = await supabase
    .from("gallery_photos")
    .select("id, image_url, caption")
    .eq("album_id", (album as { id: string }).id)
    .order("position")
    .order("created_at");
  return { album: album as unknown as Album, photos: (photos ?? []) as Photo[] };
}

// Album tanpa sampul memakai foto pertamanya.
export async function firstPhotoByAlbum(albumIds: string[]): Promise<Map<string, string>> {
  const supabase = await db();
  if (!supabase || albumIds.length === 0) return new Map();
  const { data } = await supabase
    .from("gallery_photos")
    .select("album_id, image_url, position")
    .in("album_id", albumIds)
    .order("position");
  const map = new Map<string, string>();
  for (const p of (data ?? []) as { album_id: string; image_url: string }[]) if (!map.has(p.album_id)) map.set(p.album_id, p.image_url);
  return map;
}

export async function listAchievements(
  filter: { level?: AchievementLevel; year?: number } = {},
  limit = 30,
  offset = 0,
): Promise<{ items: Achievement[]; total: number }> {
  const supabase = await db();
  if (!supabase) return { items: [], total: 0 };
  let query = supabase
    .from("achievements")
    .select("id, title, recipient, level, organizer, achieved_on, description, image_url, news:news_id (slug)", { count: "exact" })
    .eq("is_published", true)
    .order("achieved_on", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filter.level) query = query.eq("level", filter.level);
  if (filter.year) query = query.gte("achieved_on", `${filter.year}-01-01`).lte("achieved_on", `${filter.year}-12-31`);
  const { data, count } = await query;
  return { items: (data ?? []) as unknown as Achievement[], total: count ?? 0 };
}

export async function listAchievementYears(): Promise<number[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("achievements").select("achieved_on").eq("is_published", true).order("achieved_on", { ascending: false }).limit(2000);
  return [...new Set(((data ?? []) as { achieved_on: string }[]).map((r) => Number(r.achieved_on.slice(0, 4))))];
}

const EVENT_COLUMNS = "id, title, description, category, starts_on, ends_on, start_time, end_time, location, visibility";

export async function listEventsBetween(start: string, end: string): Promise<CalendarEvent[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .eq("is_published", true)
    .lte("starts_on", end)
    .gte("ends_on", start)
    .order("starts_on")
    .order("start_time", { nullsFirst: true });
  return (data ?? []) as CalendarEvent[];
}

export async function listUpcomingEvents(fromDate: string, limit = 4): Promise<CalendarEvent[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .eq("is_published", true)
    .gte("ends_on", fromDate)
    .order("starts_on")
    .limit(limit);
  return (data ?? []) as CalendarEvent[];
}

export async function listPublicAnnouncements(limit = 20, offset = 0): Promise<{ items: PublicAnnouncement[]; total: number }> {
  const supabase = await db();
  if (!supabase) return { items: [], total: 0 };
  const { data, count } = await supabase
    .from("announcements")
    .select("id, title, body, published_at", { count: "exact" })
    .eq("audience", "publik")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range(offset, offset + limit - 1);
  return { items: (data ?? []) as PublicAnnouncement[], total: count ?? 0 };
}
