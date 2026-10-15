# Arsitektur

Kondisi per 14 Oktober 2026. Diperbarui setiap kali struktur berubah.

## Gambaran umum

```
Pengunjung / warga sekolah (browser)
        │ HTTPS
        ▼
Aplikasi Next.js 16 (server Node.js)  ── dijalankan di hosting Node.js (Hostinger Business/Cloud atau Vercel)
  • src/proxy.ts         : penyegaran sesi, blok area privat tanpa login, CSP nonce
  • src/instrumentation.ts : cek konfigurasi wajib saat server mulai (log tanpa nilai)
  • Server Components    : membaca data per permintaan
  • Server Actions       : semua perubahan data (cek peran di server)
  • Route Handlers       : callback OAuth, webhook email, cron, ekspor CSV, unduh PDF
                           (tautan sementara), /api/health
        │ HTTPS (anon key + sesi pengguna, atau service role khusus server)
        ▼
Supabase
  • Auth      : akun email/Google
  • Postgres  : seluruh data + Row Level Security (RLS)
  • Storage   : news-images & site-media (baca publik), documents (PRIVAT)
        │
        ▼
Resend (email konfirmasi & buletin)   ← webhook status ke /api/newsletter/webhook
Penjadwal (GitHub Actions/cron hPanel) → /api/cron/newsletter (Bearer CRON_SECRET)
```

## Lapisan keamanan

1. **Proxy** (`src/proxy.ts`): menolak area `/dashboard`, `/admin`, `/akun` tanpa login dan
   memasang Content-Security-Policy dengan nonce per permintaan (`src/lib/security/csp.ts`).
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
Peran staf `administrasi` (Petugas Administrasi) mengelola tahun ajaran, jadwal & impor,
arsip SK, dan perpustakaan. Petugas Teknis tidak berupa peran aplikasi: akses database
hanya lewat Supabase Dashboard (lihat `docs/PANDUAN_DATABASE.md`).

## Modul & tabel

| Modul | Tabel | Kode |
|-------|-------|------|
| Akun & peran | `profiles`, `verification_requests`, `school_roster`, `admin_audit_log` | `src/lib/auth`, `src/app/akun`, `src/app/admin/verifikasi`, `src/app/admin/pengguna` |
| Berita & CMS | `news`, `news_categories`, `news_tags`, `news_tag_links`, `news_revisions`, `staff_roles`; Storage bucket `news-images` | `src/app/berita`, `src/app/admin/berita`, `src/lib/cms`, `src/components/cms` |
| Langganan berita | `newsletter_subscribers`, `newsletter_confirmation_tokens`, `newsletter_suppression_records`, `newsletter_templates`, `newsletter_campaigns`, `newsletter_campaign_items`, `newsletter_deliveries`, `newsletter_delivery_events`, `rate_limit_hits` | `src/lib/newsletter`, `src/app/langganan`, `src/app/admin/langganan` |
| Konten situs | `site_profile`, `site_pages`, `school_programs`, `gallery_albums`, `gallery_photos`, `achievements`, `calendar_events`; Storage bucket `site-media` | `src/app/{profil,galeri,prestasi,kalender,pengumuman}`, `src/app/admin/{profil-sekolah,halaman,program,galeri,prestasi,kalender}`, `src/app/admin/konten/actions.ts`, `src/lib/content` |
| Administrasi sekolah | `academic_years`, `semesters`, `schedule_import_batches`, `decrees`, `library_items`; kolom `schedule_entries.semester_id/import_batch_id`; Storage bucket **privat** `documents` | `src/app/admin/{tahun-ajaran,jadwal,arsip-sk,perpustakaan}`, `src/app/admin/sekolah/actions.ts`, `src/app/{dokumen,perpustakaan}`, `src/lib/school` |
| Dashboard internal | `announcements`, `announcement_reads`, `schedule_entries`, `assignments` | `src/app/dashboard`, `src/app/admin/pengumuman`, `src/app/admin/jadwal` |
| Ruang Rasa | `rasa_reports`, `rasa_messages`, `rasa_handlers`, `rasa_access_log` (tanpa hak tabel untuk peran mana pun; akses hanya lewat fungsi `rasa_*`); kolom `app_settings.rasa_*`. Isi dienkripsi AES-256-GCM di aplikasi | `src/app/ruang-rasa`, `src/app/dashboard/bk/ruang-rasa`, `src/app/admin/ruang-rasa`, `src/lib/rasa`, `src/components/rasa` |
| Pengaturan | `app_settings` | `src/app/admin/pengaturan` |
| Operasional | `admin_audit_log` (+ trigger `audit_content_change`), fungsi `admin_system_status()`, `school_purge_stale()` | `src/app/admin/status`, `src/app/admin/log`, `src/lib/ops` |

Prinsip isolasi: modul buletin hanya membaca berita **publik yang terbit**; tidak ada
relasi antara tabel buletin dan pengumuman/jadwal/tugas. Modul Ruang Rasa terisolasi
lebih ketat: tabelnya tidak dapat dibaca langsung oleh anon/authenticated, hanya modul
`lib/rasa` yang boleh menyentuhnya, dan tes statis (`tests/security-static.test.ts`)
menggagalkan CI bila ada modul lain (buletin, berita, galeri, dst.) yang merujuknya.

## Struktur folder

```
src/app/        halaman & route (App Router)
src/components/ komponen UI bersama
src/lib/        logika: auth, cms, content, school, newsletter, dashboard, ops, security, supabase
src/proxy.ts    proxy (pengganti middleware di Next 16)
supabase/migrations/  skema database (urut waktu, aditif)
supabase/tests/       uji RLS, alur, hak akses (dijalankan scripts/test-db.sh)
scripts/        uji database, backup/pulih (+ uji), smoke test
tests/          unit test (Vitest), termasuk tes keamanan statis
docs/           dokumentasi (indeks: docs/README.md)
```

## Hal yang belum ada

Pemasangan produksi (Supabase & Hostinger) belum
dilakukan; Ruang Rasa belum diuji dengan layanan sungguhan (`docs/PANDUAN_RUANG_RASA.md`); panduannya di `docs/PANDUAN_DEPLOYMENT_HOSTINGER.md`. Lihat juga
`docs/SERAH_TERIMA.md`.
