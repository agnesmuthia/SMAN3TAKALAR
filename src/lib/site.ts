// Konfigurasi publik situs. Hanya berisi nilai yang aman tampil di browser.

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SCHOOL_NAME || "SMA Negeri 3 Takalar",
  shortName: process.env.NEXT_PUBLIC_SCHOOL_SHORT_NAME || "SMAN 3 Takalar",
  description: "Website resmi sekolah: berita, informasi, dan layanan warga sekolah.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  // Logo hanya ditampilkan bila sekolah telah menyediakan dan mengizinkan URL-nya.
  logoUrl: process.env.NEXT_PUBLIC_SCHOOL_LOGO_URL || null,
  timeZone: "Asia/Makassar",
  // Kontak resmi: hanya ditampilkan bila diisi. Jangan mengisi data karangan.
  contact: {
    address: process.env.NEXT_PUBLIC_SCHOOL_ADDRESS || null,
    phone: process.env.NEXT_PUBLIC_SCHOOL_PHONE || null,
    email: process.env.NEXT_PUBLIC_SCHOOL_EMAIL || null,
  },
} as const;

// Portal resmi buku Kemendikdasmen (ditautkan, tidak di-host ulang).
export const PORTAL_BUKU_URL = "https://buku.kemendikdasmen.go.id/";

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

// Tanggal kalender murni (YYYY-MM-DD) tanpa pergeseran zona waktu.
export function formatTanggalSaja(isoDate: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
