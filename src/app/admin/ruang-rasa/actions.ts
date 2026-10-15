"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionFormState } from "@/components/action-form";
import { getAuthContext } from "@/lib/auth/dal";

// Hanya Super Admin. Super Admin mengatur SIAPA petugasnya dan kebijakan
// (masa simpan, catatan prosedur darurat), tetapi TIDAK dapat membaca laporan.

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });

async function adminOnly() {
  const ctx = await getAuthContext();
  if (!ctx?.user || ctx.profile?.status !== "active" || ctx.profile.role !== "admin") return null;
  return ctx as typeof ctx & { user: NonNullable<typeof ctx.user> };
}

export async function setRasaHandlerAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await adminOnly();
  if (!ctx) return fail("Akses ditolak.");
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return fail("Data tidak valid.");
  const enabled = formData.get("enabled") === "1";
  const { error } = await ctx.supabase.rpc("admin_set_rasa_handler", { p_user_id: userId.data, p_enabled: enabled });
  if (error) {
    if (error.code === "22023") return fail("Hanya akun Guru BK yang aktif yang dapat ditugaskan.");
    return fail("Penugasan gagal disimpan.");
  }
  revalidatePath("/admin/ruang-rasa");
  return ok(enabled ? "Guru BK ditugaskan sebagai petugas Ruang Rasa." : "Penugasan dicabut.");
}

const settingsSchema = z.object({
  months: z.coerce.number().int().min(3, "Masa simpan minimal 3 bulan.").max(60, "Masa simpan maksimal 60 bulan."),
  notice: z.string().trim().max(1000, "Catatan maksimal 1000 karakter."),
});

export async function saveRasaSettingsAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await adminOnly();
  if (!ctx) return fail("Akses ditolak.");
  const parsed = settingsSchema.safeParse({ months: formData.get("months"), notice: formData.get("notice") ?? "" });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Data tidak valid.");
  const { error } = await ctx.supabase
    .from("app_settings")
    .update({ rasa_retention_months: parsed.data.months, rasa_notice: parsed.data.notice || null, updated_by: ctx.user.id })
    .eq("id", true);
  if (error) return fail("Pengaturan gagal disimpan.");
  revalidatePath("/admin/ruang-rasa");
  revalidatePath("/ruang-rasa");
  return ok("Pengaturan Ruang Rasa disimpan.");
}
