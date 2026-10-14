import type { NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Nonce baru per permintaan; Next.js memasangnya otomatis pada skrip framework.
  const nonce = createNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Lewati aset statis, gambar, dan endpoint mesin (webhook/cron) yang
    // tidak memakai sesi pengguna.
    "/((?!_next/static|_next/image|favicon.ico|api/newsletter/webhook|api/cron|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|csv|xlsx)$).*)",
  ],
};
