import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Untuk pemantau uptime & pemeriksaan pasca-deploy. Tidak membuka informasi
// sistem (versi, konfigurasi, jumlah data). 503 bila database tidak terjangkau.
export async function GET() {
  let database: "ok" | "error" | "belum_dikonfigurasi" = "belum_dikonfigurasi";
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from("site_profile").select("id").limit(1);
      database = error ? "error" : "ok";
    } catch {
      database = "error";
    }
  }
  const ok = database === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "bermasalah", database, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
