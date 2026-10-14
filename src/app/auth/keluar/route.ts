import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";

function go(path: string) {
  const response = NextResponse.redirect(new URL(path, siteConfig.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Keluar dilakukan lewat POST (formulir di header).
export async function POST() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return go("/");
}

// GET hanya dipakai untuk mengeluarkan akun yang sudah DINONAKTIFKAN admin.
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured() || request.nextUrl.searchParams.get("alasan") !== "akun_nonaktif") {
    return go("/");
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle<{ status: string }>();
    if (profile?.status !== "disabled") return go("/dashboard");
    await supabase.auth.signOut();
  }
  return go("/masuk?error=akun_nonaktif");
}
