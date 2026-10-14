import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeWithToken } from "@/lib/newsletter/service";
import { absoluteUrl } from "@/lib/site";

// Berhenti berlangganan sekali klik (RFC 8058) dari tombol "Unsubscribe"
// bawaan klien email (header List-Unsubscribe-Post).
export async function POST(request: NextRequest) {
  const ok = await unsubscribeWithToken(request.nextUrl.searchParams.get("token")).catch(() => false);
  return new NextResponse(ok ? "Berhenti berlangganan berhasil." : "Tautan tidak valid.", {
    status: ok ? 200 : 400,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

// Membuka URL ini di browser diarahkan ke halaman konfirmasi (tanpa efek).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  return NextResponse.redirect(absoluteUrl(`/langganan/berhenti?token=${encodeURIComponent(token)}`), 303);
}
