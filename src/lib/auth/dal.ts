import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile, UserRole } from "./types";
import { canAccessPath, homeForRole, resolvePostLoginDestination } from "./routing";

// Data Access Layer: satu-satunya tempat membaca sesi & profil di server.
// Setiap halaman privat dan server action memanggil fungsi di sini; proxy
// hanya lapisan pertama.

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User | null;
  profile: Profile | null;
};

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  // Selalu dirender per permintaan (sesi berbeda tiap pengguna), juga saat
  // build berjalan tanpa environment variables.
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  // getUser() memvalidasi token ke server Supabase (bukan hanya membaca cookie).
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, profile_completed_at, verified_at")
    .eq("id", data.user.id)
    .maybeSingle<Profile>();

  return { supabase, user: data.user, profile: profile ?? null };
});

export async function hasOpenVerificationRequest(ctx: AuthContext): Promise<boolean> {
  if (!ctx.user) return false;
  const { count } = await ctx.supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.user.id)
    .eq("status", "submitted");
  return (count ?? 0) > 0;
}

export async function requireUser(nextPath: string): Promise<AuthContext & { user: User }> {
  const ctx = await getAuthContext();
  if (!ctx?.user) {
    redirect(`/masuk?next=${encodeURIComponent(nextPath)}`);
  }
  if (ctx.profile?.status === "disabled") {
    redirect("/auth/keluar?alasan=akun_nonaktif");
  }
  return ctx as AuthContext & { user: User };
}

// Mewajibkan akun AKTIF dengan salah satu peran. Akun pending diarahkan ke
// pelengkapan profil/menunggu verifikasi; peran lain diarahkan ke dashboard
// miliknya sendiri.
export async function requireRole(
  roles: UserRole[] | "any",
  nextPath: string,
): Promise<AuthContext & { user: User; profile: Profile & { role: UserRole } }> {
  const ctx = await requireUser(nextPath);
  const profile = ctx.profile;
  if (!profile || profile.status !== "active" || !profile.role) {
    redirect(
      resolvePostLoginDestination(
        profile ? { role: profile.role, status: profile.status, hasOpenVerificationRequest: await hasOpenVerificationRequest(ctx) } : null,
        null,
      ),
    );
  }
  if (roles !== "any" && (!roles.includes(profile.role) || !canAccessPath(profile.role, nextPath))) {
    redirect(`${homeForRole(profile.role)}?error=akses_ditolak`);
  }
  return ctx as AuthContext & { user: User; profile: Profile & { role: UserRole } };
}

// Untuk server action admin: melempar error (bukan redirect) bila bukan admin.
export async function assertAdmin(): Promise<AuthContext & { user: User; profile: Profile }> {
  const ctx = await getAuthContext();
  if (!ctx?.user || ctx.profile?.status !== "active" || ctx.profile.role !== "admin") {
    throw new Error("Akses ditolak.");
  }
  return ctx as AuthContext & { user: User; profile: Profile };
}
