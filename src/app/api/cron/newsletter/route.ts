import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cronSecret } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingCampaigns } from "@/lib/newsletter/service";

export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Dipanggil penjadwal (Vercel Cron atau layanan cron lain) dengan header
// Authorization: Bearer <CRON_SECRET>. Melanjutkan antrean kampanye dan
// menjalankan pembersihan data sesuai kebijakan retensi.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return new NextResponse("Tidak diizinkan.", { status: 401 });

  const campaigns = await processPendingCampaigns();
  const admin = createAdminClient();
  const { data: purge } = await admin.rpc("newsletter_purge_stale");
  const { data: schoolPurge } = await admin.rpc("school_purge_stale");

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      campaignId: c.campaignId,
      ok: c.result.ok,
      ...(c.result.ok ? { batch: c.result.batch } : { error: c.result.error }),
    })),
    purge,
    schoolPurge,
  });
}
