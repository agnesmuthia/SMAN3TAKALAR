import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Lewati aset statis, gambar, dan endpoint mesin (webhook/cron) yang
    // tidak memakai sesi pengguna.
    "/((?!_next/static|_next/image|favicon.ico|api/newsletter/webhook|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
