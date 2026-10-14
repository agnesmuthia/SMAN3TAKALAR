import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SemesterOption } from "./labels";

export async function listSemesters(supabase: SupabaseClient): Promise<SemesterOption[]> {
  const { data } = await supabase
    .from("semesters")
    .select("id, term, is_active, starts_on, year:academic_year_id (name)")
    .order("starts_on", { ascending: false })
    .limit(40);
  return (data ?? []) as unknown as SemesterOption[];
}

// Pilihan semester dari query string: id semester, "lama" (jadwal tanpa
// semester), atau default semester aktif / terbaru.
export function pickSemester(semesters: SemesterOption[], raw: unknown): SemesterOption | "lama" | null {
  if (raw === "lama") return "lama";
  if (typeof raw === "string") {
    const found = semesters.find((s) => s.id === raw);
    if (found) return found;
  }
  return semesters.find((s) => s.is_active) ?? semesters[0] ?? null;
}
