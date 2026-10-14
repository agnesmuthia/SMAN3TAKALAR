# Panduan Deployment (Hostinger + Supabase)

Untuk **petugas teknis**. Panduan ini memasang website ke produksi: database & login di
**Supabase**, aplikasi Next.js di **Hostinger** (aplikasi web Node.js), email lewat
**Resend**. Ikuti berurutan; centang checklist di bagian 9 sebelum diumumkan.

> **Status:** panduan disusun dari dokumentasi resmi Hostinger dan Supabase serta diuji
> sejauh yang bisa dilakukan tanpa akun produksi (build, smoke test lokal). Deployment ke
> akun sekolah **belum pernah dilakukan**. Catat hasil setiap langkah di bagian 11.

## 1. Gambaran

```
Pengunjung ──https──▶ Hostinger (Next.js, Node.js 22) ──▶ Supabase (PostgreSQL, Auth, Storage)
                             │                               ▲
                             └──▶ Resend (email)             │
Penjadwal (GitHub Actions / cron hPanel) ──▶ /api/cron/newsletter
```

- Hostinger hanya menjalankan aplikasi. **Data tidak disimpan di Hostinger** (bukan
  MySQL/phpMyAdmin hPanel).
- Supabase menyimpan database, akun login, dan file.

## 2. Prasyarat

| Kebutuhan | Keterangan |
|-----------|------------|
| Paket Hostinger | **Business Web Hosting atau Cloud** (Startup/Professional/Enterprise). Menurut Hostinger, aplikasi web Node.js hanya tersedia di paket tersebut ([Hostinger: Add a Node.js Web App](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger)). Paket Single/Premium **tidak bisa** menjalankan aplikasi ini tanpa upgrade. VPS juga bisa, tetapi butuh konfigurasi manual (Node, PM2, Nginx) yang tidak dibahas di sini |
| Domain | Mis. `sman3takalar.sch.id`, dengan akses ke pengaturan DNS |
| Akun | Supabase (organisasi sekolah), GitHub (repository), Google Cloud (login Google), Resend (email). Semua dengan **2FA** |
| Komputer petugas | Node.js 20+, Git, PostgreSQL client tools, untuk migrasi & backup |
| Pengelola kata sandi | Untuk menyimpan semua kunci & kata sandi. Jangan di dokumen/chat |

## 3. Supabase produksi

1. **Buat proyek** di organisasi sekolah: region terdekat (mis. *Southeast Asia
   (Singapore)*), kata sandi database acak panjang (simpan di pengelola sandi). Pilih
   paket sesuai kebutuhan backup (lihat `PANDUAN_BACKUP_PEMULIHAN.md` §2).
2. **Terapkan struktur database** dari komputer petugas (folder repository):
   ```bash
   npm ci
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push        # menerapkan semua file supabase/migrations
   ```
   **Jangan** menjalankan `supabase/seed.sql` (data fiktif) di produksi.
3. **Authentication → URL Configuration**
   - *Site URL*: `https://<domain>`
   - *Redirect URLs*: `https://<domain>/auth/callback` dan `https://<domain>/auth/confirm`
     (hapus `localhost` dari proyek produksi).
4. **Authentication → Email Templates**: ubah tautan konfirmasi & reset kata sandi agar
   memakai `/auth/confirm?token_hash=…` (teks persisnya di `google-oauth.md` §3).
5. **SMTP kustom (wajib untuk produksi).** Pengirim email bawaan Supabase sangat dibatasi
   dan tidak cocok untuk produksi; email konfirmasi/reset bisa tidak terkirim. Atur
   **Authentication → SMTP Settings** memakai Resend (host, port, pengguna, dan kata
   sandi berupa API key sesuai dokumentasi SMTP Resend), dengan alamat pengirim pada
   domain yang sudah diverifikasi.
6. **Kebijakan kata sandi & keamanan Auth:** panjang minimal ≥ 10, konfirmasi email aktif,
   dan *leaked password protection* bila tersedia pada paket. Rekomendasi lengkap ada di
   `AUDIT_KEAMANAN.md` R2.
7. **Login Google:** ikuti `google-oauth.md` (OAuth client di Google Cloud, provider
   Google di Supabase, redirect URI Supabase).
8. Catat untuk langkah 4: *Project URL*, *anon key*, *service role key* (**rahasia**),
   dan *connection string* database (untuk backup).

## 4. Environment variables

Isi di Hostinger (bagian 5, langkah 4). Nilai dari `.env.example` adalah placeholder.

| Variabel | Wajib | Nilai |
|----------|-------|-------|
| `NEXT_PUBLIC_SITE_URL` | Ya | `https://<domain>` (tanpa `/` di akhir) |
| `NEXT_PUBLIC_SCHOOL_NAME`, `NEXT_PUBLIC_SCHOOL_SHORT_NAME` | Ya | Nama resmi sekolah |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya | Dari Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | **Rahasia**, jangan diberi awalan `NEXT_PUBLIC_` |
| `NEWSLETTER_TOKEN_SECRET` | Ya | Acak ≥ 32 karakter (`openssl rand -base64 48`) |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Untuk email | `resend`, API key, alamat pengirim terverifikasi |
| `RESEND_WEBHOOK_SECRET` | Disarankan | `whsec_…` dari webhook Resend → `https://<domain>/api/newsletter/webhook` |
| `CRON_SECRET` | Disarankan | Acak ≥ 16 karakter; sama dengan yang dipakai penjadwal (bagian 7) |
| `NEXT_PUBLIC_SCHOOL_LOGO_URL`, `NEXT_PUBLIC_SCHOOL_ADDRESS/PHONE/EMAIL` | Tidak | Lebih baik diisi lewat **Admin → Profil Sekolah** |

Penting:
- Variabel `NEXT_PUBLIC_*` **ditanam saat build**. Setelah mengubahnya, lakukan
  **redeploy** (build ulang), bukan sekadar restart.
- Jangan mengisi `EMAIL_PROVIDER=console` di produksi (akan ditolak aplikasi).
- Saat server mulai, aplikasi mencatat di log nama variabel wajib yang belum benar
  (tanpa nilainya). Setelah online, Super Admin dapat memeriksa `/admin/status`.

## 5. Aplikasi Node.js di Hostinger

Langkah mengikuti dokumentasi Hostinger ([Creating an app](https://docs.hostinger.com/node.js/creating-an-app),
[Deploy dari GitHub](https://docs.hostinger.com/node.js/github),
[Environment variables](https://docs.hostinger.com/node.js/environment-variables)).
Nama menu di hPanel dapat sedikit berbeda.

1. hPanel → **Websites → Add website → Node.js Web App → Import Git repository**.
2. Hubungkan GitHub lewat aplikasi GitHub Hostinger, lalu pilih repository ini dan branch
   produksi (`main`). Satu paket hosting hanya dapat terhubung ke satu akun GitHub.
3. Periksa pengaturan build yang terdeteksi otomatis:

   | Pengaturan | Nilai |
   |------------|-------|
   | Framework | Next.js |
   | Node.js | **22** (sesuai `.nvmrc`; minimal 20.9) |
   | Build command | `npm run build` |
   | Output directory | `.next` |
   | Start command (bila diminta) | `npm start` |

4. Isi **environment variables** (bagian 4) **sebelum build pertama**. Hostinger
   menyuntikkan variabel ke tahap build dan runtime, dan nilainya bertahan antar deploy.
   Bisa diimpor sekaligus dari file `.env` yang **dibuat sementara di komputer petugas
   lalu dihapus**.
5. Jalankan deploy. Periksa **log build** bila gagal (bagian 10).
6. Auto-deploy aktif: setiap push ke branch produksi memicu build baru. Gabungkan ke
   `main` hanya setelah CI hijau.

## 6. Domain & HTTPS

1. Hubungkan domain ke aplikasi di hPanel (atau arahkan DNS sesuai petunjuk hPanel).
2. Pastikan SSL aktif dan `http://` dialihkan ke `https://`.
3. Pastikan `NEXT_PUBLIC_SITE_URL`, Supabase *Site URL/Redirect URLs*, dan redirect URI
   Google memakai domain yang **sama persis**.
4. Aplikasi sudah mengirim header HSTS, CSP, dan header keamanan lain; tidak perlu
   menambahkannya di hosting.

## 7. Penjadwal (cron)

`/api/cron/newsletter` melanjutkan pengiriman buletin bertahap dan membersihkan data
kedaluwarsa (token, pratinjau impor lama). Endpoint ini butuh header
`Authorization: Bearer <CRON_SECRET>`. Pilih **salah satu** cara:

| Cara | Langkah | Catatan |
|------|---------|---------|
| **A. GitHub Actions** (sudah disiapkan) | Di GitHub → Settings → Secrets and variables → Actions: variable `CRON_URL` = `https://<domain>/api/cron/newsletter`, secret `CRON_SECRET` | Berjalan tiap 30 menit (`.github/workflows/cron.yml`). Jadwal GitHub bisa tertunda; di repository privat memakai kuota menit Actions; GitHub dapat menonaktifkan jadwal pada repository yang lama tidak aktif (periksa tab Actions bulanan) |
| B. Cron hPanel | Bila tersedia di paket: **Advanced → Cron Jobs → Custom**, perintah `curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/newsletter` | Jadwal hPanel memakai UTC. Ketersediaan cron untuk paket aplikasi Node.js belum dipastikan; tanyakan dukungan Hostinger |
| C. Layanan cron eksternal | Layanan yang dapat mengirim header Authorization | Simpan rahasia di layanan tersebut dengan hati-hati |

`vercel.json` hanya berlaku bila aplikasi di-hosting di Vercel; diabaikan di Hostinger.
Admin tetap dapat melanjutkan pengiriman kampanye secara manual dari dashboard.

## 8. Langkah pertama setelah online

1. `npm run smoke -- https://<domain>` dari komputer petugas → semua lulus (termasuk
   `/api/health` dengan `database: ok`).
2. Daftarkan akun pengelola, lalu jadikan **Super Admin pertama** (`PANDUAN_DATABASE.md`
   §10.1), dan tetapkan **Super Admin cadangan**.
3. Masuk sebagai Super Admin, buka `/admin/status`: tidak ada peringatan wajib, migrasi
   terakhir sesuai repository, bucket `documents` privat.
4. Isi **Profil Sekolah**, halaman profil, tahun ajaran & semester (`PANDUAN_OPERASIONAL_ADMIN.md` §3).
5. Uji alur: daftar akun uji → verifikasi; reset kata sandi (email diterima); login Google;
   langganan berita (email konfirmasi diterima, berhenti berlangganan berfungsi);
   unggah gambar berita; unggah & unduh satu SK internal (sebagai warga sekolah).
6. Jalankan **backup pertama** dan **uji pemulihan** ke proyek uji
   (`PANDUAN_BACKUP_PEMULIHAN.md` §4 & §6).
7. Daftarkan `https://<domain>/api/health` di layanan pemantau uptime (opsional) agar
   petugas diberi tahu bila situs/database bermasalah.

## 9. Checklist go-live

Centang semua sebelum website diumumkan.

**Infrastruktur**
- [ ] Paket Hostinger mendukung aplikasi Node.js; build & deploy berhasil
- [ ] Domain HTTPS aktif; `http` dialihkan ke `https`
- [ ] Semua environment variables wajib terisi; `/admin/status` tanpa peringatan wajib
- [ ] Migrasi terakhir di `/admin/status` sama dengan file terbaru di `supabase/migrations`
- [ ] Penjadwal cron aktif (cara A/B/C) dan sekali dicoba berhasil (HTTP 200)
- [ ] `npm run smoke -- https://<domain>` lulus semua

**Akun & keamanan**
- [ ] Dua Super Admin aktif; tidak ada akun uji tersisa dengan peran admin
- [ ] 2FA aktif di Supabase, GitHub, Hostinger, Google Cloud, Resend
- [ ] Supabase Auth: Site URL & Redirect URLs hanya domain resmi; SMTP kustom aktif
- [ ] Google OAuth consent screen berstatus produksi (bukan *testing*)
- [ ] Semua kunci tersimpan di pengelola sandi sekolah; tidak ada di chat/dokumen

**Konten (informasi resmi)**
- [ ] Profil sekolah, kontak, logo resmi (dengan izin), halaman profil terisi dan diperiksa
- [ ] Tidak ada data contoh/fiktif yang tampil
- [ ] Kebijakan privasi diperiksa pihak sekolah

**Data**
- [ ] Backup pertama (database + Storage) dibuat dan disimpan di 2 lokasi
- [ ] Uji pemulihan pertama berhasil dan dicatat (`PANDUAN_BACKUP_PEMULIHAN.md` §10)
- [ ] Data induk NIP/NIS (bila dipakai) diimpor oleh petugas berwenang

## 10. Pembaruan, rollback, dan pemecahan masalah

**Pembaruan rutin**
1. Perubahan masuk lewat pull request, dan CI harus hijau.
2. Bila ada migrasi baru: **backup dulu**, lalu `npx supabase db push` **sebelum**
   menggabungkan ke `main` (migrasi selalu aditif, jadi kode lama tetap berjalan).
3. Gabungkan ke `main`; Hostinger membangun ulang otomatis. Setelah itu jalankan smoke test.

**Rollback aplikasi:** di hPanel, deploy ulang versi sebelumnya (bila tersedia di riwayat
deployment), atau `git revert` commit bermasalah lalu push ke `main`. Migrasi database
tidak di-rollback otomatis. Migrasi yang sudah diterapkan aman untuk kode lama karena
hanya menambah.

| Gejala | Penyebab umum / solusi |
|--------|------------------------|
| Log berisi `Environment variable … belum diisi`, atau halaman 503 "Supabase belum dikonfigurasi" | Environment belum diisi; isi lalu **redeploy** |
| Build kehabisan memori/waktu | Coba ulang; periksa batas sumber daya paket; hubungi dukungan Hostinger |
| Login Google kembali ke halaman masuk dengan error | Redirect URL Supabase/Google tidak cocok dengan domain; lihat `google-oauth.md` |
| Email konfirmasi/reset tidak datang | SMTP kustom belum diatur atau domain pengirim belum terverifikasi |
| Tautan email mengarah ke `localhost` | *Site URL* Supabase atau `NEXT_PUBLIC_SITE_URL` salah |
| Gambar/PDF tidak tampil | Bucket belum ada (migrasi belum diterapkan) atau `SUPABASE_SERVICE_ROLE_KEY` salah |
| `/api/health` 503 | Database tidak terjangkau atau kunci salah; periksa status Supabase & environment |
| Buletin tidak terkirim bertahap | Penjadwal belum aktif atau `CRON_SECRET` berbeda; cek log Actions/cron |

## 11. Catatan pelaksanaan (diisi sekolah)

| Langkah | Tanggal | Petugas | Hasil |
|---------|---------|---------|-------|
| Paket Hostinger dikonfirmasi (nama paket) | | | |
| Proyek Supabase produksi dibuat (ref, region) | | | |
| Migrasi diterapkan (versi terakhir) | | | |
| Aplikasi Hostinger pertama kali online | | | |
| Domain & HTTPS aktif | | | |
| Google login & SMTP diuji | | | |
| Penjadwal cron aktif (cara) | | | |
| Smoke test produksi lulus | | | |
| Backup & uji pemulihan pertama | | | |
| Go-live diumumkan | | | |
