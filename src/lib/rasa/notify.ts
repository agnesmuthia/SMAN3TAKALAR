import "server-only";
import { resolveEmailProvider } from "@/lib/newsletter/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/site";
import { rasaKey } from "./service";
import { rateKey } from "./crypto";

// Email singkat ke Guru BK yang ditugaskan. SENGAJA tidak memuat apa pun dari
// laporan (tanpa kategori, tanpa tingkat urgensi, tanpa isi), hanya tautan ke
// dashboard. Gagal mengirim tidak pernah menggagalkan laporan. Tidak terkait
// dengan modul buletin.
export async function notifyHandlers(kind: "baru" | "balasan"): Promise<void> {
  try {
    const key = rasaKey();
    const provider = resolveEmailProvider(process.env);
    if (!key || !provider.configured) return;
    const admin = createAdminClient();

    // Batas global agar banjir laporan tidak membanjiri kotak masuk petugas.
    const { data: ok } = await admin.rpc("check_rate_limit", {
      p_bucket: "rasa_notify", p_key_hash: rateKey("semua", key), p_max: 20, p_window_seconds: 60 * 60,
    });
    if (ok !== true) return;

    const { data: ids } = await admin.rpc("rasa_handler_ids");
    const url = absoluteUrl("/dashboard/bk/ruang-rasa");
    const headline = kind === "baru" ? "Ada laporan baru di Ruang Rasa." : "Ada balasan baru pada sebuah laporan di Ruang Rasa.";
    for (const id of (ids as string[] | null) ?? []) {
      const { data } = await admin.auth.admin.getUserById(id);
      const to = data.user?.email;
      if (!to) continue;
      const result = await provider.provider.send({
        to,
        subject: "Ruang Rasa: ada pembaruan",
        text: `${headline}\n\nMasuk ke dashboard Guru BK untuk melihatnya:\n${url}\n\nEmail ini sengaja tidak memuat isi laporan. Jangan membalas email ini.`,
        html: `<p>${headline}</p><p><a href="${url}">Buka dashboard Guru BK</a></p><p style="color:#64748b;font-size:12px">Email ini sengaja tidak memuat isi laporan. Jangan membalas email ini.</p>`,
      });
      if (!result.ok) console.error("[ruang-rasa] notifikasi email gagal:", result.retryable ? "sementara" : "ditolak");
    }
  } catch (error) {
    console.error("[ruang-rasa] notifikasi gagal:", error instanceof Error ? error.name : "unknown");
  }
}
