import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";

// Tautan dari email Supabase Auth (konfirmasi pendaftaran / reset kata
// sandi) memakai token_hash. Lihat docs/google-oauth.md bagian template email.
const ALLOWED_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "email_change"];

function go(path: string) {
  const response = NextResponse.redirect(new URL(path, siteConfig.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return go("/masuk?error=konfigurasi");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return go("/masuk?error=tautan_tidak_valid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return go("/masuk?error=tautan_tidak_valid");

  return go(type === "recovery" ? "/reset-password" : "/dashboard");
}
