# Arsitektur

Kondisi per 14 Oktober 2026. Diperbarui setiap kali struktur berubah.

## Gambaran umum

```
Pengunjung / warga sekolah (browser)
        │ HTTPS
        ▼
Aplikasi Next.js 16 (server Node.js)  ── dijalankan di hosting Node.js (Hostinger Business/Cloud atau Vercel)
  • src/proxy.ts         : penyegaran sesi & blok area privat tanpa login
  • Server Components    : membaca data per permintaan
  • Server Actions       : semua perubahan data (cek peran di server)
  • Route Handlers       : callback OAuth, webhook email, cron, ekspor CSV
        │ HTTPS (anon key + sesi pengguna, atau service role khusus server)
        ▼
Supabase
  • Auth      : akun email/Google
  • Postgres  : seluruh data + Row Level Security (RLS)
        │
        ▼
Resend (email konfirmasi & buletin)   ← webhook status ke /api/newsletter/webhook
```

## Lapisan keamanan

1. **Proxy** (`src/proxy.ts`): menolak area `/dashboard`, `/admin`, `/akun` tanpa login.
2. **Data Access Layer** (`src/lib/auth/dal.ts`): setiap halaman privat & server action
   memeriksa status akun dan peran.
3. **RLS di database**: pembatasan terakhir yang tetap berlaku walau ada bug di aplikasi.
4. **Service role key** hanya dipakai di modul `server-only` untuk alur tanpa sesi
   (langganan publik, pengiriman email, webhook) atau setelah pemeriksaan admin.

## Peran (saat ini)

Peran dasar `admin` (= Super Admin), `guru`, `siswa`, `guru_bk`, ditambah status
`pending`/`active`/`disabled`. Peran staf CMS di tabel `staff_roles`: `admin_website`
(menerbitkan berita, mengelola konten situs & pengumuman) dan `editor` (menulis & mengirim untuk persetujuan), berlaku di atas peran
dasar. Detail: `docs/peran-dan-verifikasi.md`, `docs/PANDUAN_ADMIN_WEBSITE.md`.
Petugas Administrasi dan Petugas Teknis belum diimplementasikan (Tahap 5–6).

## Modul & tabel

| Modul | Tabel | Kode |
|-------|-------|------|
| Akun & peran | `profiles`, `verification_requests`, `school_roster`, `admin_audit_log` | `src/lib/auth`, `src/app/akun`, `src/app/admin/verifikasi`, `src/app/admin/pengguna` |
| Berita & CMS | `news`, `news_categories`, `news_tags`, `news_tag_links`, `news_revisions`, `staff_roles`; Storage bucket `news-images` | `src/app/berita`, `src/app/admin/berita`, `src/lib/cms`, `src/components/cms` |
| Langganan berita | `newsletter_subscribers`, `newsletter_confirmation_tokens`, `newsletter_suppression_records`, `newsletter_templates`, `newsletter_campaigns`, `newsletter_campaign_items`, `newsletter_deliveries`, `newsletter_delivery_events`, `rate_limit_hits` | `src/lib/newsletter`, `src/app/langganan`, `src/app/admin/langganan` |
| Konten situs | `site_profile`, `site_pages`, `school_programs`, `gallery_albums`, `gallery_photos`, `achievements`, `calendar_events`; Storage bucket `site-media` | `src/app/{profil,galeri,prestasi,kalender,pengumuman}`, `src/app/admin/{profil-sekolah,halaman,program,galeri,prestasi,kalender}`, `src/app/admin/konten/actions.ts`, `src/lib/content` |
| Dashboard internal | `announcements`, `announcement_reads`, `schedule_entries`, `assignments` | `src/app/dashboard`, `src/app/admin/pengumuman`, `src/app/admin/jadwal` |
| Pengaturan | `app_settings` | `src/app/admin/pengaturan` |

Prinsip isolasi: modul buletin hanya membaca berita **publik yang terbit**; tidak ada
relasi antara tabel buletin dan pengumuman/jadwal/tugas. Modul Ruang Rasa (belum ada)
wajib terisolasi dengan cara yang sama.

## Struktur folder

```
src/app/        halaman & route (App Router)
src/components/ komponen UI bersama
src/lib/        logika: auth, newsletter, dashboard, supabase client
src/proxy.ts    proxy (pengganti middleware di Next 16)
supabase/migrations/  skema database (urut waktu, aditif)
supabase/tests/       uji RLS & alur (dijalankan scripts/test-db.sh)
tests/          unit test (Vitest)
docs/           dokumentasi
```

## Hal yang belum ada

Tahun ajaran & impor, arsip SK, perpustakaan digital, Ruang Rasa, konfigurasi Hostinger,
prosedur backup. Lihat `docs/AUDIT_DAN_RENCANA.md`.
