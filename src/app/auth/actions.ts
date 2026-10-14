"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/redirect";
import { resolvePostLoginDestination } from "@/lib/auth/routing";
import { absoluteUrl } from "@/lib/site";
import type { AccountStatus, UserRole } from "@/lib/auth/types";

export type FormState = { status: "idle" | "success" | "error"; message: string };

const NOT_CONFIGURED: FormState = { status: "error", message: "Layanan masuk belum dikonfigurasi." };

const credentials = z.object({
  email: z.email("Format email tidak valid.").max(254),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(72),
});

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = credentials.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: "Email atau kata sandi tidak valid." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { status: "error", message: "Email atau kata sandi salah, atau email belum dikonfirmasi." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", data.user.id)
    .maybeSingle<{ role: UserRole | null; status: AccountStatus }>();

  if (profile?.status === "disabled") {
    await supabase.auth.signOut();
    return { status: "error", message: "Akun Anda dinonaktifkan. Hubungi admin sekolah." };
  }

  const { count } = await supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .eq("status", "submitted");

  redirect(
    resolvePostLoginDestination(
      profile ? { role: profile.role, status: profile.status, hasOpenVerificationRequest: (count ?? 0) > 0 } : null,
      safeNextPath(String(formData.get("next") ?? "")),
    ),
  );
}

const signUpSchema = credentials
  .extend({ passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { message: "Konfirmasi kata sandi tidak sama.", path: ["passwordConfirm"] });

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signUpSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const supabase = await createClient();
  // Tidak ada metadata (NIP/NIS/peran) yang dikirim ke penyedia autentikasi.
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: absoluteUrl("/auth/confirm") },
  });
  if (error && error.code !== "user_already_exists") {
    console.warn("[auth] pendaftaran gagal:", error.code ?? error.name);
    if (error.code === "weak_password") {
      return { status: "error", message: "Kata sandi terlalu lemah. Gunakan kombinasi yang lebih kuat." };
    }
    return { status: "error", message: "Pendaftaran belum dapat diproses. Silakan coba lagi nanti." };
  }
  return {
    status: "success",
    message:
      "Jika alamat email dapat didaftarkan, kami telah mengirim tautan konfirmasi. Setelah konfirmasi, masuk lalu lengkapi profil untuk verifikasi peran.",
  };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { status: "error", message: "Format email tidak valid." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: absoluteUrl("/auth/confirm") });
  return {
    status: "success",
    message: "Jika email terdaftar, kami telah mengirim tautan untuk mengatur ulang kata sandi.",
  };
}

const resetSchema = z
  .object({ password: credentials.shape.password, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { message: "Konfirmasi kata sandi tidak sama." });

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = resetSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    passwordConfirm: String(formData.get("passwordConfirm") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", message: "Sesi pemulihan tidak valid. Minta tautan baru." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: "Kata sandi gagal diperbarui. Coba kata sandi lain." };
  redirect("/dashboard");
}
