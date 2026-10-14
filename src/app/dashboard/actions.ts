"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthContext } from "@/lib/auth/dal";
import { isHttpsUrl } from "@/lib/dashboard/schedule";
import type { ActionFormState } from "@/components/action-form";

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });

async function activeMember() {
  const ctx = await getAuthContext();
  if (!ctx?.user || ctx.profile?.status !== "active" || !ctx.profile.role) return null;
  return ctx as typeof ctx & { user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile> };
}

async function activeTeacher() {
  const ctx = await activeMember();
  return ctx && ctx.profile.role === "guru" ? ctx : null;
}

export async function markAnnouncementReadAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await activeMember();
  if (!ctx) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("announcementId"));
  if (!id.success) return fail("Data tidak valid.");
  // RLS memastikan hanya pengumuman yang boleh dilihat pengguna yang dapat ditandai.
  const { error } = await ctx.supabase
    .from("announcement_reads")
    .upsert({ announcement_id: id.data, user_id: ctx.user.id }, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
  if (error) return fail("Gagal menandai pengumuman.");
  revalidatePath("/dashboard", "layout");
  return ok("Ditandai sudah dibaca.");
}

const assignmentSchema = z.object({
  id: z.uuid().optional(),
  className: z.string().trim().min(1, "Kelas wajib diisi.").max(40),
  kind: z.enum(["tugas", "materi"]),
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(200),
  description: z.string().trim().max(5000, "Deskripsi maksimal 5000 karakter."),
  linkUrl: z
    .string()
    .trim()
    .max(1000)
    .refine((v) => v === "" || isHttpsUrl(v), "Tautan harus diawali https://"),
  dueAt: z.string().trim().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Tenggat tidak valid."),
  published: z.boolean(),
});

export async function saveAssignmentAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await activeTeacher();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = assignmentSchema.safeParse({
    id: formData.get("id") || undefined,
    className: formData.get("className") ?? "",
    kind: formData.get("kind"),
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    dueAt: formData.get("dueAt") ?? "",
    published: formData.get("published") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const v = parsed.data;

  const row = {
    class_name: v.className,
    kind: v.kind,
    title: v.title,
    description: v.description,
    link_url: v.linkUrl || null,
    // Input datetime-local dibaca sebagai waktu WITA (UTC+8).
    due_at: v.dueAt ? new Date(`${v.dueAt}${v.dueAt.length === 16 ? ":00+08:00" : ""}`).toISOString() : null,
    published: v.published,
  };

  // RLS menjamin guru hanya dapat mengubah/menambah miliknya sendiri.
  if (v.id) {
    const { data, error } = await ctx.supabase.from("assignments").update(row).eq("id", v.id).select("id");
    if (error || !data?.length) return fail("Tugas tidak ditemukan atau bukan milik Anda.");
    revalidatePath("/dashboard/guru/tugas");
    return ok("Perubahan disimpan.");
  }
  const { error } = await ctx.supabase.from("assignments").insert({ ...row, teacher_id: ctx.user.id });
  if (error) return fail("Tugas gagal disimpan.");
  revalidatePath("/dashboard/guru/tugas");
  redirect("/dashboard/guru/tugas?disimpan=1");
}

export async function deleteAssignmentAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await activeTeacher();
  if (!ctx) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return fail("Data tidak valid.");
  const { data, error } = await ctx.supabase.from("assignments").delete().eq("id", id.data).select("id");
  if (error || !data?.length) return fail("Tugas tidak ditemukan atau bukan milik Anda.");
  revalidatePath("/dashboard/guru/tugas");
  redirect("/dashboard/guru/tugas");
}
