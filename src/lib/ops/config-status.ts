// Pemeriksaan konfigurasi environment untuk halaman Status Sistem.
// HANYA melaporkan ada/tidak & format; nilai rahasia tidak pernah dikembalikan.
import { resolveEmailProvider } from "@/lib/newsletter/provider";

export type ConfigCheck = {
  key: string;
  label: string;
  required: boolean;
  ok: boolean;
  note: string;
};

type Env = Record<string, string | undefined>;

const isPlaceholder = (value: string) => /GANTI|CHANGE_ME|xxx/i.test(value);
const present = (value: string | undefined): value is string => Boolean(value && value.trim() && !isPlaceholder(value));

export function checkConfig(env: Env): ConfigCheck[] {
  const production = env.NODE_ENV === "production";
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
  const siteOk = present(siteUrl) && (/^https:\/\//.test(siteUrl) || (!production && /^http:\/\/localhost/.test(siteUrl)));
  const tokenSecret = env.NEWSLETTER_TOKEN_SECRET ?? "";
  const email = resolveEmailProvider({ ...env } as Parameters<typeof resolveEmailProvider>[0]);
  const webhook = env.RESEND_WEBHOOK_SECRET ?? "";
  const cron = env.CRON_SECRET ?? "";

  return [
    {
      key: "NEXT_PUBLIC_SITE_URL",
      label: "Alamat situs",
      required: true,
      ok: siteOk,
      note: siteOk ? "Terisi." : production ? "Wajib https:// di produksi (dipakai untuk login Google & tautan email)." : "Belum diisi.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      label: "URL Supabase",
      required: true,
      ok: present(env.NEXT_PUBLIC_SUPABASE_URL) && /^https?:\/\//.test(env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
      note: present(env.NEXT_PUBLIC_SUPABASE_URL) ? "Terisi." : "Belum diisi atau masih contoh.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "Kunci publik Supabase (anon)",
      required: true,
      ok: present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      note: present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ? "Terisi." : "Belum diisi atau masih contoh.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      label: "Kunci service role (rahasia, server saja)",
      required: true,
      ok: present(env.SUPABASE_SERVICE_ROLE_KEY),
      note: present(env.SUPABASE_SERVICE_ROLE_KEY) ? "Terisi." : "Belum diisi: unggah file, langganan, dan unduh PDF tidak berfungsi.",
    },
    {
      key: "NEWSLETTER_TOKEN_SECRET",
      label: "Rahasia token langganan",
      required: true,
      ok: present(tokenSecret) && tokenSecret.length >= 32,
      note: !present(tokenSecret) ? "Belum diisi atau masih contoh." : tokenSecret.length < 32 ? "Kurang dari 32 karakter." : "Terisi.",
    },
    {
      key: "EMAIL_PROVIDER",
      label: "Pengiriman email (Resend)",
      required: false,
      ok: email.configured,
      note: email.configured ? "Terkonfigurasi (belum tentu sudah diuji kirim)." : email.reason,
    },
    {
      key: "RESEND_WEBHOOK_SECRET",
      label: "Webhook Resend (pantulan/keluhan email)",
      required: false,
      ok: present(webhook) && webhook.startsWith("whsec_"),
      note: !present(webhook) ? "Belum diisi: email terpental tidak tercatat otomatis." : webhook.startsWith("whsec_") ? "Terisi." : "Format harus diawali whsec_.",
    },
    {
      key: "CRON_SECRET",
      label: "Rahasia penjadwal (cron)",
      required: false,
      ok: present(cron) && cron.length >= 16,
      note: !present(cron) ? "Belum diisi: antrean buletin & pembersihan data tidak berjalan otomatis." : cron.length < 16 ? "Terlalu pendek (min. 16 karakter)." : "Terisi.",
    },
  ];
}
