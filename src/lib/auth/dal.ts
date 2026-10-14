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
    .select("id, full_name, role, status, profile_completed_at, verified_at, class_name")
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

// -----------------------------------------------------------------------------
// Akses staf CMS (Super Admin = role admin; Admin Website; Editor)
// -----------------------------------------------------------------------------

export type StaffRole = "admin_website" | "editor";
export type StaffAccess = {
  isSuperAdmin: boolean;
  roles: StaffRole[];
  canPublish: boolean;
  canWrite: boolean;
};

const NO_ACCESS: StaffAccess = { isSuperAdmin: false, roles: [], canPublish: false, canWrite: false };

export const getStaffAccess = cache(async (): Promise<StaffAccess> => {
  const ctx = await getAuthContext();
  if (!ctx?.user || ctx.profile?.status !== "active") return NO_ACCESS;
  const isSuperAdmin = ctx.profile.role === "admin";
  const { data } = await ctx.supabase.from("staff_roles").select("role").eq("user_id", ctx.user.id);
  const roles = ((data ?? []) as { role: StaffRole }[]).map((r) => r.role);
  const canPublish = isSuperAdmin || roles.includes("admin_website");
  return { isSuperAdmin, roles, canPublish, canWrite: canPublish || roles.includes("editor") };
});

type StaffContext = AuthContext & { user: User; profile: Profile & { role: UserRole } } & { access: StaffAccess };

// Area /admin: Super Admin atau pemilik peran staf apa pun.
export async function requireAdminArea(nextPath: string): Promise<StaffContext> {
  const ctx = await requireRole("any", nextPath);
  const access = await getStaffAccess();
  if (!access.isSuperAdmin && !access.canWrite) {
    redirect(`${homeForRole(ctx.profile.role)}?error=akses_ditolak`);
  }
  return { ...ctx, access };
}

export async function requireNewsWriter(nextPath: string): Promise<StaffContext> {
  const ctx = await requireAdminArea(nextPath);
  if (!ctx.access.canWrite) redirect("/admin?error=akses_ditolak");
  return ctx;
}

export async function requireNewsPublisher(nextPath: string): Promise<StaffContext> {
  const ctx = await requireAdminArea(nextPath);
  if (!ctx.access.canPublish) redirect("/admin?error=akses_ditolak");
  return ctx;
}

// Untuk server action: kembalikan null (bukan redirect) bila tidak berhak.
export async function newsActionContext(): Promise<(AuthContext & { user: User; profile: Profile; access: StaffAccess }) | null> {
  const ctx = await getAuthContext();
  if (!ctx?.user || ctx.profile?.status !== "active") return null;
  const access = await getStaffAccess();
  if (!access.canWrite) return null;
  return { ...(ctx as AuthContext & { user: User; profile: Profile }), access };
}
