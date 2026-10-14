import "server-only";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Kueri publik memakai sesi pemanggil: RLS hanya mengembalikan dokumen yang
// ditampilkan untuk pengunjung (dan internal untuk warga sekolah aktif).

async function db() {
  await connection();
  return isSupabaseConfigured() ? createClient() : null;
}

const clean = (q: string) => q.replace(/[%,()*\\]/g, " ").trim();

export type PublicDecree = {
  id: string; number: string; title: string; issued_on: string; issuer: string | null;
  status: "berlaku" | "arsip"; visibility: "public" | "internal"; year: { name: string } | null;
};

export async function listDecrees(
  filter: { q?: string; status?: "berlaku" | "arsip"; yearId?: string },
  limit = 20,
  offset = 0,
): Promise<{ items: PublicDecree[]; total: number }> {
  const supabase = await db();
  if (!supabase) return { items: [], total: 0 };
  let query = supabase
    .from("decrees")
    .select("id, number, title, issued_on, issuer, status, visibility, year:academic_year_id (name)", { count: "exact" })
    .eq("is_published", true)
    .order("issued_on", { ascending: false })
    .range(offset, offset + limit - 1);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.yearId) query = query.eq("academic_year_id", filter.yearId);
  const q = filter.q ? clean(filter.q) : "";
  if (q) query = query.or(`number.ilike.%${q}%,title.ilike.%${q}%`);
  const { data, count } = await query;
  return { items: (data ?? []) as unknown as PublicDecree[], total: count ?? 0 };
}

export async function listAcademicYears(): Promise<{ id: string; name: string }[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("academic_years").select("id, name").order("starts_on", { ascending: false });
  return (data ?? []) as { id: string; name: string }[];
}

export type LibraryItem = {
  id: string; title: string; author: string | null; category: string; description: string;
  kind: "tautan" | "pdf"; url: string | null; cover_image_url: string | null; visibility: "public" | "internal";
};

export async function listLibraryItems(filter: { q?: string; category?: string }, limit = 24, offset = 0): Promise<{ items: LibraryItem[]; total: number }> {
  const supabase = await db();
  if (!supabase) return { items: [], total: 0 };
  let query = supabase
    .from("library_items")
    .select("id, title, author, category, description, kind, url, cover_image_url, visibility", { count: "exact" })
    .eq("is_published", true)
    .order("category")
    .order("title")
    .range(offset, offset + limit - 1);
  if (filter.category) query = query.eq("category", filter.category);
  const q = filter.q ? clean(filter.q) : "";
  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,description.ilike.%${q}%`);
  const { data, count } = await query;
  return { items: (data ?? []) as LibraryItem[], total: count ?? 0 };
}

export async function listLibraryCategories(): Promise<string[]> {
  const supabase = await db();
  if (!supabase) return [];
  const { data } = await supabase.from("library_items").select("category").eq("is_published", true).limit(1000);
  return [...new Set(((data ?? []) as { category: string }[]).map((r) => r.category))].sort((a, b) => a.localeCompare(b, "id"));
}
