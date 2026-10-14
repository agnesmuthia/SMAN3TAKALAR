import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

// Ekspor HANYA pelanggan aktif (yang sudah memberi persetujuan) untuk
// keperluan operasional. Setiap unduhan dicatat di log audit.
export async function GET() {
  let ctx;
  try {
    ctx = await assertAdmin();
  } catch {
    return new NextResponse("Akses ditolak.", { status: 403 });
  }

  const rows: (string | null)[][] = [["email", "dikonfirmasi_pada", "sumber", "versi_kebijakan"]];
  const pageSize = 1000;
  for (let from = 0; from < 50_000; from += pageSize) {
    const { data, error } = await ctx.supabase
      .from("newsletter_subscribers")
      .select("email, confirmed_at, source, consent_policy_version")
      .eq("status", "active")
      .not("email", "is", null)
      .order("confirmed_at")
      .range(from, from + pageSize - 1);
    if (error) return new NextResponse("Gagal mengekspor data.", { status: 500 });
    const batch = (data ?? []) as { email: string; confirmed_at: string | null; source: string | null; consent_policy_version: string }[];
    rows.push(...batch.map((r) => [r.email, r.confirmed_at, r.source, r.consent_policy_version]));
    if (batch.length < pageSize) break;
  }

  await createAdminClient().from("admin_audit_log").insert({
    actor_id: ctx.user.id,
    action: "newsletter.export",
    target_type: "newsletter_subscribers",
    details: { rows: rows.length - 1 },
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pelanggan-aktif-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
