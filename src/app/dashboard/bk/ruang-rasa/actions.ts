"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionFormState } from "@/components/action-form";
import { getAuthContext } from "@/lib/auth/dal";
import { encryptStaffReply } from "@/lib/rasa/service";

type State = ActionFormState;
const ok = (message: string): State => ({ status: "success", message });
const fail = (message: string): State => ({ status: "error", message });

async function bkContext() {
  const ctx = await getAuthContext();
  if (!ctx?.user || ctx.profile?.status !== "active" || ctx.profile.role !== "guru_bk") return null;
  return ctx as typeof ctx & { user: NonNullable<typeof ctx.user> };
}

function mapError(code: string | undefined): State {
  if (code === "42501") return fail("Akun Anda belum ditugaskan sebagai petugas Ruang Rasa.");
  if (code === "22023") return fail("Laporan ini sudah selesai. Buka kembali laporan sebelum membalas.");
  if (code === "P0002") return fail("Laporan tidak ditemukan (mungkin sudah dihapus otomatis).");
  return fail("Tindakan gagal. Silakan coba lagi.");
}

// Fungsi database memeriksa bahwa pemanggil adalah petugas yang ditugaskan dan
// mencatat setiap tindakan di log akses.
export async function rasaStaffReplyAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await bkContext();
  if (!ctx) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("id"));
  const text = z.string().trim().min(2, "Tulis balasan terlebih dahulu.").max(3000, "Balasan maksimal 3000 karakter.").safeParse(formData.get("text") ?? "");
  if (!id.success) return fail("Data tidak valid.");
  if (!text.success) return fail(text.error.issues[0]?.message ?? "Balasan tidak valid.");
  const sealed = encryptStaffReply(id.data, text.data);
  if (!sealed) return fail("Kunci enkripsi Ruang Rasa belum diatur di server.");
  const { error } = await ctx.supabase.rpc("rasa_reply", { p_id: id.data, p_content: sealed });
  if (error) return mapError(error.code);
  revalidatePath(`/dashboard/bk/ruang-rasa/${id.data}`);
  return ok("Balasan terkirim. Pelapor akan melihatnya lewat kode dan PIN.");
}

export async function rasaSetStatusAction(_prev: State, formData: FormData): Promise<State> {
  const ctx = await bkContext();
  if (!ctx) return fail("Akses ditolak.");
  const id = z.uuid().safeParse(formData.get("id"));
  const status = z.enum(["baru", "diproses", "selesai"]).safeParse(formData.get("status"));
  if (!id.success || !status.success) return fail("Data tidak valid.");
  const { error } = await ctx.supabase.rpc("rasa_set_status", { p_id: id.data, p_status: status.data });
  if (error) return mapError(error.code);
  revalidatePath("/dashboard/bk/ruang-rasa", "layout");
  return ok("Status diperbarui.");
}
