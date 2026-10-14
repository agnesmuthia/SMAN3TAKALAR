# Website SMA Negeri 3 Takalar

Website resmi sekolah berbasis **Next.js 16 (App Router) + Supabase**: portal berita,
profil & konten sekolah yang dikelola tanpa coding, dashboard guru/siswa/BK, administrasi
sekolah (tahun ajaran, impor jadwal, arsip SK, perpustakaan), dan langganan berita email.

Mulai dari **[docs/SERAH_TERIMA.md](docs/SERAH_TERIMA.md)** (ringkasan & status), lalu
**[indeks dokumentasi](docs/README.md)**. Semua panduan berbahasa Indonesia.

## Fitur

| Area | Isi |
|------|-----|
| Publik | Beranda, berita (kategori, tag, cari), profil, pengumuman, galeri, prestasi, kalender, perpustakaan, arsip SK, langganan berita |
| Akun | Email/kata sandi & Google; verifikasi guru/siswa oleh admin. Login **tidak pernah** memberi peran otomatis |
| Dashboard | Guru (jadwal, tugas & materi), siswa (jadwal semester aktif, tugas), Guru BK (kerangka), pengumuman internal |
| CMS & admin | Alur berita draf → review → terbit/terjadwal → arsip dengan revisi; halaman, program, galeri, prestasi, kalender, profil sekolah; tahun ajaran, impor jadwal CSV/XLSX dengan pratinjau; arsip SK privat; perpustakaan; pengguna & peran; Status Sistem; Log Aktivitas |
| Operasional | Backup/pulih terenkripsi, smoke test, `/api/health`, penjadwal cron |

## Status

| Bagian | Status |
|--------|--------|
| Kode & pengujian otomatis | Selesai: 196 unit test, 234 asersi database, uji backup→pulih, smoke test |
| Proyek Supabase produksi, hosting Hostinger | **Belum dipasang.** Ikuti [docs/PANDUAN_DEPLOYMENT_HOSTINGER.md](docs/PANDUAN_DEPLOYMENT_HOSTINGER.md) |
| Login Google, email (Resend) | Kode selesai; **aktif setelah kredensial asli dikonfigurasi** ([google-oauth](docs/google-oauth.md), [email](docs/langganan-berita-email.md)) |
| Backup | Skrip diuji di PostgreSQL lokal; **uji pertama di Supabase sungguhan belum dilakukan** |
| Ruang Rasa | Belum dibangun; menunggu keputusan kebijakan sekolah |

## Menjalankan secara lokal

Prasyarat: Node.js 20.9+ (disarankan 22, lihat `.nvmrc`) dan proyek Supabase
(cloud untuk pengembangan, atau Supabase CLI lokal).

```bash
npm ci
cp .env.example .env.local        # isi nilai Supabase & rahasia (lihat komentar di file)
npx supabase link --project-ref <project-ref-pengembangan>
npx supabase db push              # menerapkan supabase/migrations/*.sql
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # opsional, data FIKTIF, jangan di produksi
npm run dev                       # http://localhost:3000
```

Isi `EMAIL_PROVIDER=console` (hanya pengembangan) untuk mencoba langganan tanpa mengirim
email. Admin pertama: [docs/PANDUAN_DATABASE.md](docs/PANDUAN_DATABASE.md) §10.1.

## Perintah

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm start` | Build & jalankan produksi |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit test (Vitest), termasuk tes keamanan statis |
| `npm run test:db` | Migrasi + RLS + audit hak akses di PostgreSQL sementara |
| `npm run test:backup` | Backup terenkripsi → pemulihan → bandingkan isi tabel |
| `npm run smoke -- <URL>` | Smoke test situs yang berjalan (lokal/produksi) |
| `npm run check` | lint + typecheck + test |
| `./scripts/backup-db.sh`, `node scripts/backup-storage.mjs` | Backup produksi ([panduan](docs/PANDUAN_BACKUP_PEMULIHAN.md)) |

## Struktur

```
src/
  app/            Halaman & route (publik, akun, dashboard, admin, api)
  components/     Komponen UI bersama (cms/ untuk komponen CMS)
  lib/            auth (DAL & peran), cms, content, school, newsletter, ops, security, supabase
  proxy.ts        Sesi Supabase, proteksi area privat, Content-Security-Policy (nonce)
  instrumentation.ts  Pemeriksaan konfigurasi saat server mulai
supabase/
  migrations/     Skema, RLS, fungsi (aditif, urut waktu)
  tests/          Stub Supabase + uji SQL (RLS, alur, hak akses)
scripts/          Uji database, backup/pulih, smoke test
tests/            Unit test
docs/             Panduan (Bahasa Indonesia)
.github/workflows CI & penjadwal cron
```

## Prinsip keamanan

- Otorisasi berlapis: proxy (login) → pemeriksaan izin di setiap halaman & server action
  → Row Level Security di database. Diuji otomatis di CI.
- Rahasia hanya di environment variables; service role key hanya di server.
- Content-Security-Policy dengan nonce, HSTS, dan header keamanan lain.
- HTML disanitasi saat disimpan dan ditampilkan; unggahan diperiksa dari isi file.
- Tidak ada endpoint SQL bebas; data pribadi (NIP/NIS, email pelanggan, SK internal)
  dipisah dan dibatasi RLS.
- Rincian: [docs/AUDIT_KEAMANAN.md](docs/AUDIT_KEAMANAN.md), [docs/ARSITEKTUR.md](docs/ARSITEKTUR.md).

## Deployment

Produksi direncanakan di **Hostinger (aplikasi web Node.js, paket Business/Cloud)** +
**Supabase**: [docs/PANDUAN_DEPLOYMENT_HOSTINGER.md](docs/PANDUAN_DEPLOYMENT_HOSTINGER.md).
`vercel.json` hanya berlaku bila sekolah memilih Vercel; di Hostinger penjadwal memakai
`.github/workflows/cron.yml` atau cron hPanel.
