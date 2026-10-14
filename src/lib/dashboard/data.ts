import "server-only";
import type { AuthContext } from "@/lib/auth/dal";
import type { ScheduleEntry } from "./schedule";

// Semua query memakai sesi pengguna sehingga RLS yang menentukan baris yang
// terlihat (siswa: kelasnya; guru: jadwal/tugas miliknya; dst.).

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  published_at: string;
  read: boolean;
};

export async function listAnnouncements(ctx: AuthContext & { user: { id: string } }, limit = 20): Promise<Announcement[]> {
  const { data } = await ctx.supabase
    .from("announcements")
    .select("id, title, body, audience, published_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Omit<Announcement, "read">[];
  if (rows.length === 0) return [];

  const { data: reads } = await ctx.supabase
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", ctx.user.id)
    .in("announcement_id", rows.map((r) => r.id));
  const readIds = new Set(((reads ?? []) as { announcement_id: string }[]).map((r) => r.announcement_id));
  return rows.map((r) => ({ ...r, read: readIds.has(r.id) }));
}

// Hanya semester aktif (plus jadwal lama tanpa semester). Bila belum ada
// semester aktif, semua jadwal yang boleh dibaca ditampilkan.
export async function listSchedule(ctx: AuthContext): Promise<ScheduleEntry[]> {
  const { data: active } = await ctx.supabase.from("semesters").select("id").eq("is_active", true).maybeSingle<{ id: string }>();
  let query = ctx.supabase
    .from("schedule_entries")
    .select("id, class_name, day_of_week, start_time, end_time, subject, room, teacher_id")
    .order("day_of_week")
    .order("start_time");
  if (active) query = query.or(`semester_id.is.null,semester_id.eq.${active.id}`);
  const { data } = await query;
  return (data ?? []) as ScheduleEntry[];
}

export async function activeSemesterName(ctx: AuthContext): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("semesters")
    .select("term, year:academic_year_id (name)")
    .eq("is_active", true)
    .maybeSingle<{ term: number; year: { name: string } | null }>();
  if (!data) return null;
  return `${data.year?.name ?? ""} · Semester ${data.term === 1 ? "Ganjil" : "Genap"}`;
}

export type Assignment = {
  id: string;
  class_name: string;
  kind: "tugas" | "materi";
  title: string;
  description: string;
  link_url: string | null;
  due_at: string | null;
  published: boolean;
  created_at: string;
  teacher: { full_name: string | null } | null;
};

const ASSIGNMENT_COLUMNS = "id, class_name, kind, title, description, link_url, due_at, published, created_at";

// Siswa: RLS hanya mengembalikan yang terbit untuk kelasnya.
export async function listAssignmentsForStudent(ctx: AuthContext, limit = 50): Promise<Assignment[]> {
  const { data } = await ctx.supabase
    .from("assignments")
    .select(ASSIGNMENT_COLUMNS)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Assignment[];
}

// Guru: RLS hanya mengembalikan milik sendiri.
export async function listAssignmentsForTeacher(ctx: AuthContext, limit = 100): Promise<Assignment[]> {
  const { data } = await ctx.supabase
    .from("assignments")
    .select(ASSIGNMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Assignment[];
}
