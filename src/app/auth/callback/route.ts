import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/redirect";
import { resolvePostLoginDestination } from "@/lib/auth/routing";
import { siteConfig } from "@/lib/site";
import type { AccountStatus, UserRole } from "@/lib/auth/types";

// Callback OAuth (Google) dan penautan identitas. Redirect selalu dibangun
// dari NEXT_PUBLIC_SITE_URL + path internal tervalidasi (anti open redirect).
function go(path: string) {
  const response = NextResponse.redirect(new URL(path, siteConfig.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const linking = next.startsWith("/akun");
  const failPath = (code: string) => (linking ? `/akun?error=${code}` : `/masuk?error=${code}`);

  if (!isSupabaseConfigured()) return go("/masuk?error=konfigurasi");

  const providerError = params.get("error");
  if (providerError) {
    // Detail error dari penyedia tidak ditampilkan ke pengguna.
    console.warn("[auth/callback] error penyedia:", params.get("error_code") ?? providerError);
    if (linking) return go(failPath("tautan_gagal"));
    return go(failPath(providerError === "access_denied" ? "oauth_dibatalkan" : "oauth_gagal"));
  }

  const code = params.get("code");
  if (!code) return go(failPath("oauth_gagal"));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn("[auth/callback] pertukaran kode gagal:", error.code ?? error.name);
    return go(failPath(linking ? "tautan_gagal" : "oauth_gagal"));
  }

  // Validasi ulang identitas ke server Supabase.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return go(failPath("oauth_gagal"));

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userData.user.id)
    .maybeSingle<{ role: UserRole | null; status: AccountStatus }>();

  if (profile?.status === "disabled") {
    await supabase.auth.signOut();
    return go("/masuk?error=akun_nonaktif");
  }

  const { count } = await supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userData.user.id)
    .eq("status", "submitted");

  if (linking) return go(next);

  return go(
    resolvePostLoginDestination(
      profile ? { role: profile.role, status: profile.status, hasOpenVerificationRequest: (count ?? 0) > 0 } : null,
      next,
    ),
  );
}
