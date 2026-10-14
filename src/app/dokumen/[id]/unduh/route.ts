import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeFileName, signedPdfUrl } from "@/lib/school/documents";
import { createClient } from "@/lib/supabase/server";

// Unduhan SK: baris dibaca dengan sesi pengguna (RLS menentukan boleh/tidak),
// baru kemudian server membuat tautan sementara 60 detik ke bucket privat.
export async function GET(_request: Request, ctx: RouteContext<"/dokumen/[id]/unduh">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !isSupabaseConfigured()) return notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("decrees").select("number, file_path").eq("id", id).maybeSingle<{ number: string; file_path: string }>();
  if (!data) return notFound();
  const url = await signedPdfUrl(data.file_path, safeFileName(`SK-${data.number}`));
  if (!url) return new NextResponse("File belum dapat dibuka. Coba lagi nanti.", { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function notFound() {
  return new NextResponse("Dokumen tidak ditemukan atau Anda tidak memiliki akses.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
