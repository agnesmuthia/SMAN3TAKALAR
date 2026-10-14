// Konfigurasi publik situs. Hanya berisi nilai yang aman tampil di browser.

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMA Negeri 3 Takalar",
  shortName: process.env.NEXT_PUBLIC_SCHOOL_SHORT_NAME || "SMAN 3 Takalar",
  description: "Website resmi sekolah: berita, informasi, dan layanan warga sekolah.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  // Logo hanya ditampilkan bila sekolah telah menyediakan dan mengizinkan URL-nya.
  logoUrl: process.env.NEXT_PUBLIC_SCHOOL_LOGO_URL || null,
  timeZone: "Asia/Makassar",
} as const;

// Naikkan setiap kali isi kebijakan privasi langganan berubah. Nilainya
// disimpan bersama setiap persetujuan pelanggan sebagai bukti.
export const PRIVACY_POLICY_VERSION = "2026-10-14";

export const NEWSLETTER_CONSENT_TEXT =
  "Saya setuju menerima email berita dan informasi terbaru dari sekolah, dan saya dapat berhenti berlangganan kapan saja.";

export function formatTanggal(value: string | Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: siteConfig.timeZone,
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
