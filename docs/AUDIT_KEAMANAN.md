# Audit Keamanan (Tahap 7)

Tanggal: 14 Oktober 2026 · Cakupan: seluruh kode di repository (aplikasi Next.js,
migrasi & RLS Supabase, skrip operasional, CI).

**Tidak termasuk:** konfigurasi proyek Supabase produksi, hosting, DNS, Google Cloud, dan
Resend, karena belum tersedia. Hal-hal itu tercantum sebagai rekomendasi (bagian 4) dan
harus diperiksa saat deployment (Tahap 8).

## 1. Metode

1. **Tinjauan kode manual:** setiap server action dan route handler, pemakaian service
   role, sanitasi HTML, unggahan file, redirect, header, dan logging.
2. **Pemeriksaan otomatis yang kini menjadi bagian CI** (gagal bila ada regresi):

| Pemeriksaan | Berkas | Isi |
|-------------|--------|-----|
| Hak akses database | `supabase/tests/16_hak_akses.sql` | Pengunjung (anon) hanya bisa **membaca** 16 tabel konten publik yang disetujui; tanpa hak tulis; hanya 1 fungsi yang bisa dipanggil; semua `SECURITY DEFINER` menetapkan `search_path`; fungsi trigger tidak bisa dipanggil langsung; RLS aktif di semua tabel; bucket dokumen privat |
| RLS per fitur | `supabase/tests/10`–`15_*.sql` | 220+ asersi perilaku per peran (234 bersama audit hak akses) |
| Server action | `tests/security-static.test.ts` | **Setiap** server action memanggil pemeriksa izin di baris awal, kecuali 7 aksi publik yang terdaftar beserta alasannya |
| Service role | `tests/security-static.test.ts` | Hanya dipakai di 11 file yang sudah ditinjau; tidak pernah di komponen klien |
| HTML mentah | `tests/security-static.test.ts` | `dangerouslySetInnerHTML` hanya di `article-body.tsx` yang menyanitasi ulang |
| Rahasia di kode | `tests/security-static.test.ts` | Tidak ada pola kunci/token/private key; tidak ada `NEXT_PUBLIC_*` berisi rahasia; tidak ada `eval` |
| CSP | `tests/csp.test.ts` + pemeriksaan browser | Nonce per permintaan; tanpa `unsafe-eval`/`unsafe-inline` untuk skrip di produksi |
| Header & akses | `scripts/smoke-test.mjs` | 36 pemeriksaan: halaman publik, halaman privat menolak tanpa login, header keamanan, endpoint mesin menolak tanpa izin, `/api/health` tanpa membuka informasi sistem |
| Backup | `scripts/test-backup-restore.sh` | Enkripsi, checksum, pengaman produksi, isi identik setelah pulih |
| Dependensi | `npm audit --omit=dev` | 0 kerentanan saat audit |

3. **Pemindaian riwayat git** untuk kunci API, token JWT, private key, connection string
   berpassword, dan file `.env`/backup: **tidak ditemukan**.

## 2. Temuan

Tingkat: **Tinggi** = dapat langsung membocorkan/mengubah data; **Sedang** = perlu kondisi
tertentu; **Rendah** = pengerasan/praktik baik.

| # | Temuan | Tingkat | Status |
|---|--------|---------|--------|
| K1 | Belum ada Content-Security-Policy, sehingga dampak XSS (bila ada celah) tidak dibatasi | Sedang | **Diperbaiki:** CSP dengan nonce per permintaan di `src/proxy.ts` (`script-src 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`). Diuji di browser: editor, server action, dan semua halaman utama berjalan tanpa pelanggaran CSP |
| K2 | Belum ada pemeriksaan otomatis bahwa setiap server action memeriksa izin; kesalahan di masa depan bisa lolos | Sedang | **Diperbaiki:** tes statis memindai semua server action (61 saat audit) |
| K3 | Hak akses tabel/fungsi untuk `anon` hanya dijaga per migrasi; migrasi baru bisa membuka akses tanpa disadari (Supabase memberi hak bawaan pada objek baru) | Sedang | **Diperbaiki:** tes daftar izin hak akses database di CI |
| K4 | Backup bergantung sepenuhnya pada fitur bawaan Supabase yang tidak mencakup file Storage | Tinggi (risiko kehilangan data) | **Diperbaiki sebagian:** skrip backup/pulih database & Storage terenkripsi + uji otomatis. **Belum diuji di Supabase sungguhan** (lihat `PANDUAN_BACKUP_PEMULIHAN.md`) |
| K5 | Cookie sesi Supabase dapat dibaca JavaScript (rancangan `@supabase/ssr` agar klien browser bekerja) | Rendah | **Diterima:** dimitigasi CSP (K1), sanitasi HTML berlapis, dan masa berlaku token pendek |
| K6 | Keluar (logout) memakai POST tanpa token CSRF khusus | Rendah | **Diterima:** cookie `SameSite=Lax`; dampak maksimal hanya membuat pengguna keluar |
| K7 | Impor XLSX di server berpotensi terkena file "zip bomb" | Rendah | **Diterima:** hanya staf berwenang, batas 2 MB / 2.000 baris, jenis file diperiksa dari isi |
| K8 | Pemeriksaan PDF bukan antivirus | Rendah | **Diterima & didokumentasikan:** PDF berisi skrip/aksi `Launch` ditolak; PDF dibuka dari domain Supabase (bukan domain situs) lewat tautan sementara 60 detik |
| K9 | Rute unduh SK membuat tautan sementara tanpa pembatasan laju | Rendah | **Diterima:** hanya untuk dokumen yang memang boleh dibaca pemanggil (RLS); tautan berlaku 60 detik |
| K10 | Penyedia email `console` mencetak isi email ke log | Rendah | **Sudah aman:** ditolak otomatis di produksi (`NODE_ENV=production`) |
| K11 | Log server dapat memuat data pribadi | Rendah | **Diperiksa:** log hanya mencatat kode/pesan error, bukan email/NIS/isi formulir |
| K12 | Belum ada MFA (verifikasi dua langkah) untuk akun admin website | Sedang | **Rekomendasi** (R3): fitur aplikasi untuk tahap lanjutan |

Kontrol yang diperiksa dan dinilai **memadai** (tanpa perubahan):
- Peran tidak pernah diambil dari metadata login/Google; perubahan peran hanya lewat
  fungsi admin yang tercatat di log.
- Akun dinonaktifkan langsung kehilangan akses RLS, dan sesi Auth-nya diblokir (*ban*).
- HTML berita/halaman disanitasi saat disimpan **dan** saat ditampilkan; gambar hanya
  dari bucket situs sendiri.
- Unggahan diperiksa dari *magic bytes* (bukan ekstensi); SVG tidak diizinkan; nama file acak.
- Redirect setelah login hanya ke path internal (uji open redirect, termasuk `/..//host`).
- Ekspor CSV pelanggan dilindungi dari *CSV/formula injection* dan dicatat di log.
- Token langganan: hash sekali pakai (konfirmasi) & HMAC (berhenti berlangganan);
  webhook Resend diverifikasi tanda tangannya; cron butuh rahasia (perbandingan *timing-safe*).
- Header: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  tanpa `X-Powered-By`.
- Filter pencarian PostgREST membuang karakter pemisah (`,()%*\`) sehingga tidak bisa
  menyisipkan kondisi tambahan.
- Tidak ada endpoint SQL bebas; Status Sistem memakai fungsi baca-saja tetap.

## 3. Risiko sisa yang diketahui

- **Kesalahan manusia** (salah memilih visibilitas SK, foto tanpa izin): dimitigasi lewat
  konfirmasi wajib, log aktivitas, dan prosedur insiden. Tidak bisa dihilangkan
  sepenuhnya oleh kode.
- **Kompromi akun Super Admin** (kata sandi lemah/phishing): lihat R1–R3.
- **Kunci service role bocor dari hosting**: melewati RLS. Batasi siapa yang punya akses
  hosting; rotasi kunci bila ragu (`PANDUAN_DATABASE.md` §10.8).
- **Konfigurasi Supabase/hosting** belum diaudit karena belum ada.

## 4. Rekomendasi untuk sekolah

| # | Rekomendasi | Siapa | Kapan |
|---|-------------|-------|-------|
| R1 | Aktifkan **2FA** pada akun Supabase, GitHub, hosting, Google Cloud, dan Resend milik petugas | Petugas teknis | Sebelum go-live |
| R2 | Di Supabase Auth: panjang kata sandi minimal ≥ 10, konfirmasi email aktif, *leaked password protection* bila tersedia pada paket, Site URL & Redirect URLs hanya domain resmi | Petugas teknis | Tahap 8 |
| R3 | Pertimbangkan MFA (TOTP) untuk akun Super Admin & Admin Website di aplikasi | Pengembang | Tahap lanjutan |
| R4 | Minimal dua Super Admin aktif; tinjau peran staf dan Log Aktivitas bulanan | Super Admin | Rutin |
| R5 | Jalankan `npm run smoke -- https://<domain>` setelah setiap deploy | Petugas teknis | Rutin |
| R6 | Lakukan uji pemulihan pertama di proyek uji, lalu tiap semester | Petugas teknis | Segera setelah proyek dibuat |
| R7 | Ulangi audit ini setiap ada modul baru yang menyimpan data sensitif (terutama **Ruang Rasa**) atau setidaknya setahun sekali | Pengembang | Berkala |

## 5. Cara menjalankan pemeriksaan

```bash
npm run lint && npm run typecheck && npm test   # termasuk tes keamanan statis & CSP
npm run test:db                                 # RLS + audit hak akses + kueri panduan
npm run test:backup                             # backup terenkripsi → pulih → bandingkan
npm audit --omit=dev
npm run smoke -- https://<domain-atau-localhost>
```
