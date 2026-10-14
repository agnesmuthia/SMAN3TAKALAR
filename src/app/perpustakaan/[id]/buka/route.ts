import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { signedPdfUrl } from "@/lib/school/documents";
import { createClient } from "@/lib/supabase/server";

// Membuka PDF perpustakaan: RLS memastikan koleksi boleh dilihat pemanggil.
export async function GET(_request: Request, ctx: RouteContext<"/perpustakaan/[id]/buka">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !isSupabaseConfigured()) return notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("library_items").select("kind, url, file_path").eq("id", id).maybeSingle<{ kind: string; url: string | null; file_path: string | null }>();
  if (!data) return notFound();
  if (data.kind === "tautan" && data.url) return NextResponse.redirect(data.url, 302);
  if (!data.file_path) return notFound();
  const url = await signedPdfUrl(data.file_path);
  if (!url) return new NextResponse("File belum dapat dibuka. Coba lagi nanti.", { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function notFound() {
  return new NextResponse("Koleksi tidak ditemukan atau Anda tidak memiliki akses.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}
