# Website SMA Negeri 3 Takalar

Website sekolah berbasis **Next.js 16 (App Router) + Supabase** dengan:

- Berita sekolah yang dapat dibaca **tanpa login**.
- Login & pendaftaran **email/kata sandi** dan **Google** (Supabase Auth, OAuth 2.0 + PKCE).
- Sistem peran **guru, siswa, Guru BK, admin** dengan verifikasi admin. Login Google
  **tidak pernah** memberi peran secara otomatis.
- **Langganan berita melalui email** dengan double opt-in, berhenti berlangganan
  tanpa login, daftar penolakan, dan dashboard admin "Langganan Berita".

Seluruh panduan berbahasa Indonesia ada di folder [`docs/`](docs/).

## Status fitur

| Fitur | Status |
|-------|--------|
| Halaman publik (beranda, berita, kebijakan privasi) | Berfungsi (butuh proyek Supabase untuk data) |
| Skema database, RLS, fungsi peran & langganan | Selesai, diuji di PostgreSQL lokal (`npm run test:db`) |
| Login email, verifikasi peran, admin | Kode selesai; perlu proyek Supabase |
| Dashboard guru / siswa / BK | Pengumuman internal, jadwal pelajaran, tugas & materi (teks + tautan); BK baru kerangka. Diuji di level database (RLS) dan unit; **belum diuji end-to-end dengan Supabase sungguhan** |
| **Login Google** | Kode selesai; **belum aktif** sampai OAuth Client Google dibuat dan provider Supabase dikonfigurasi ([panduan](docs/google-oauth.md)) |
| **Pengiriman email** (konfirmasi & buletin) | Kode selesai; **belum aktif** sampai domain pengirim terverifikasi dan Resend dikonfigurasi ([panduan](docs/langganan-berita-email.md)) |
| Ruang Rasa, dokumen SK, unggah file tugas | Belum dibangun |

## Menjalankan secara lokal

Prasyarat: Node.js 20.9+ dan proyek Supabase (cloud atau Supabase CLI lokal).

```bash
npm install
cp .env.example .env.local      # isi nilai Supabase & rahasia (lihat komentar di file)
```

Terapkan migrasi ke proyek Supabase:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push            # menerapkan supabase/migrations/*.sql
# opsional, hanya untuk pengembangan: data berita fiktif
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Lalu:

```bash
npm run dev                     # http://localhost:3000
```

Untuk mencoba alur langganan tanpa mengirim email, isi `EMAIL_PROVIDER=console`
(hanya di pengembangan): email konfirmasi dicetak di terminal.

Buat admin pertama sesuai [docs/peran-dan-verifikasi.md](docs/peran-dan-verifikasi.md).

## Perintah

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm start` | Build & jalankan produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm test` | Pengujian unit (Vitest) |
| `npm run test:db` | Pengujian migrasi + RLS di PostgreSQL sementara |
| `npm run check` | lint + typecheck + test |

## Struktur

```
src/
  app/                    Halaman & route (App Router)
    berita/               Berita publik
    masuk/ daftar/        Autentikasi (email + Google)
    auth/callback|confirm|keluar   Callback OAuth, verifikasi email, logout
    akun/                 Pelengkapan profil, menunggu verifikasi, penautan Google
    dashboard/            Dashboard guru / siswa / BK, pengumuman
    admin/                Verifikasi, pengguna, berita, pengumuman, jadwal, Langganan Berita, pengaturan
    langganan/            Konfirmasi & berhenti berlangganan (publik)
    api/newsletter/       Unsubscribe sekali klik, webhook penyedia email
    api/cron/newsletter   Pengiriman bertahap & retensi
  lib/
    auth/                 DAL sesi/peran, validasi redirect, routing peran
    newsletter/           Token, template, penyedia email, pengirim bertahap, webhook
    supabase/             Klien server/browser/service role, proxy sesi
  proxy.ts                Penyegaran sesi & proteksi area privat (Next 16 "proxy")
supabase/
  migrations/             Skema, RLS, fungsi
  tests/                  Stub auth + pengujian SQL
  seed.sql                Data fiktif
docs/                     Panduan konfigurasi & pengujian (Bahasa Indonesia)
```

## Prinsip keamanan

- Semua rahasia di environment variables; `.env.example` hanya berisi placeholder.
  Client Secret Google hanya di dasbor Supabase.
- Otorisasi berlapis: proxy (login) → DAL di setiap halaman & server action (status
  dan peran) → Row Level Security di database.
- Redirect setelah login hanya ke path internal tervalidasi (anti open redirect).
- NIP/NIS tidak pernah masuk metadata OAuth; hanya dapat dibaca pemilik & admin.
- Tidak ada analitik pihak ketiga.
- Buletin hanya memuat berita publik yang terbit; setiap email dikirim ke satu penerima.

## Deploy (Vercel)

1. Impor repository di Vercel, isi environment variables sesuai `.env.example`.
2. Atur `NEXT_PUBLIC_SITE_URL` ke domain produksi.
3. `vercel.json` menjadwalkan `/api/cron/newsletter` (isi `CRON_SECRET`).
4. Ikuti [docs/google-oauth.md](docs/google-oauth.md) dan
   [docs/langganan-berita-email.md](docs/langganan-berita-email.md).
