"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import type { ActionFormState } from "@/components/action-form";

const schema = z
  .object({
    claimedRole: z.enum(["guru", "siswa"], { message: "Pilih peran guru atau siswa." }),
    fullName: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
    identifier: z.string().trim().regex(/^[0-9]{4,20}$/, "NIP/NIS hanya berisi angka (4–20 digit)."),
    className: z.string().trim().max(40).optional(),
  })
  .refine((v) => v.claimedRole !== "siswa" || Boolean(v.className), {
    message: "Kelas wajib diisi untuk siswa.",
  });

const ERRORS: Record<string, string> = {
  request_already_open: "Permintaan verifikasi Anda masih diproses admin.",
  profile_not_pending: "Akun Anda sudah diverifikasi atau tidak dapat mengajukan verifikasi.",
};

export async function submitVerificationAction(_prev: ActionFormState, formData: FormData): Promise<ActionFormState> {
  const ctx = await requireUser("/akun/lengkapi-profil");
  const parsed = schema.safeParse({
    claimedRole: formData.get("claimedRole"),
    fullName: formData.get("fullName") ?? "",
    identifier: formData.get("identifier") ?? "",
    className: (formData.get("className") as string | null) || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  // Data identitas sekolah disimpan di tabel verifikasi (RLS: pemilik &
  // admin), tidak pernah ke metadata akun Google/Supabase Auth.
  const { error } = await ctx.supabase.rpc("submit_verification_request", {
    p_claimed_role: parsed.data.claimedRole,
    p_full_name: parsed.data.fullName,
    p_identifier: parsed.data.identifier,
    p_class_name: parsed.data.claimedRole === "siswa" ? parsed.data.className ?? null : null,
  });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { status: "error", message: key ? ERRORS[key] : "Permintaan gagal dikirim. Silakan coba lagi." };
  }
  redirect("/akun/menunggu");
}
