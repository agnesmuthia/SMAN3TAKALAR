# Audit Proyek & Rencana Implementasi (Tahap 1)

Tanggal audit: 14 Oktober 2026 · Basis: branch `main` (commit `7b5dd50`).
Dokumen ini hanya mencatat **fakta yang ditemukan di repository**. Hal yang tidak dapat
diperiksa dari repository ditandai **"belum diketahui"**.

## 1. Ringkasan teknologi

| Aspek | Temuan |
|-------|--------|
| Framework | Next.js 16.4 (App Router, `src/proxy.ts`), React 19.3, TypeScript |
| Styling | Tailwind CSS 4 (token warna di `src/app/globals.css`) |
| Database | **Supabase (PostgreSQL)**. Skema di `supabase/migrations/` (3 migrasi) |
| Autentikasi | **Supabase Auth**: email + kata sandi dan Google (OAuth/PKCE) |
| Email | Resend (kode siap, belum dikonfigurasi) |
| Pengujian | ESLint, TypeScript, Vitest (68 test), uji SQL/RLS di PostgreSQL sementara (108 asersi) |
| CI | GitHub Actions `.github/workflows/ci.yml` (lint, typecheck, test, build, uji database) |
| Deployment | `vercel.json` (cron harian). **Tidak ada konfigurasi Hostinger.** |

## 2. Status koneksi nyata

| Hal | Status |
|-----|--------|
| Proyek Supabase produksi (project ref, URL) | **Belum diketahui.** Tidak ada `.env`, `supabase/config.toml`, atau project ref di repo |
| Migrasi sudah diterapkan ke Supabase | **Belum diketahui / kemungkinan belum** |
| Website sudah online | **Belum diketahui.** Tidak ada domain atau konfigurasi hosting tercatat |
| Akun admin pertama | Belum dibuat (prosedur SQL di `docs/peran-dan-verifikasi.md`) |
| Google OAuth, Resend | Belum dikonfigurasi (butuh kredensial asli) |

Semua kode sudah membaca data dari database (bukan hardcoded) **kecuali** teks beranda,
footer, dan kebijakan privasi yang masih ditulis di file TSX.

## 3. Cara konten disimpan saat ini

| Konten | Penyimpanan | Catatan |
|--------|-------------|---------|
| Berita | Tabel `news` | Isi teks biasa (paragraf), gambar via **URL**, tanpa kategori/tag/jadwal/persetujuan/riwayat |
| Pengumuman internal | `announcements`, `announcement_reads` | Untuk warga sekolah yang login |
| Jadwal pelajaran | `schedule_entries` | Input manual satu per satu oleh admin; **belum ada impor CSV/XLSX** |
| Tugas & materi | `assignments` | Teks + tautan https; **belum ada unggah file** |
| Langganan berita | `newsletter_*` (8 tabel) | Double opt-in, kampanye, daftar penolakan |
| Profil/visi-misi/kontak | **Hardcoded di TSX** | Belum bisa diubah lewat dashboard |
| Gambar/dokumen | **Tidak ada penyimpanan file** (Supabase Storage belum dipakai) | |

## 4. Cara masuk dashboard (sesuai kode)

1. Buka `https://<domain>/masuk` (lokal: `http://localhost:3000/masuk`).
2. Masuk dengan email/kata sandi atau Google.
3. Akun berperan `admin` diarahkan ke `/admin`; guru/siswa/Guru BK ke `/dashboard/...`.
4. Keluar: tombol **Keluar** di header (POST `/auth/keluar`).
5. Admin pertama dibuat sekali lewat SQL Editor Supabase; admin berikutnya di `/admin/pengguna`.

## 5. Cara petugas teknis mengakses database (sesuai teknologi nyata)

Database dikelola melalui **Supabase Dashboard** (bukan phpMyAdmin/hPanel, karena proyek
tidak memakai MySQL). Lihat `docs/PANDUAN_DATABASE.md`. Website **tidak** menyediakan
endpoint SQL bebas, dan admin konten tidak perlu membuka database untuk pekerjaan rutin.

## 6. Kecocokan hosting (Hostinger)

- Proyek ini adalah aplikasi Next.js dengan server (render per permintaan, server action,
  route handler), sehingga **membutuhkan hosting Node.js**, bukan hosting statis/PHP biasa.
- Menurut dokumentasi resmi Hostinger, aplikasi web Node.js (termasuk Next.js, Node 18–24,
  deploy dari GitHub) tersedia di paket **Business Web Hosting** dan **Cloud**; paket lain
  perlu upgrade, dan VPS memerlukan konfigurasi manual.
  Sumber: [Hostinger – How to add a Node.js Web App](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger),
  [Hostinger – Next.js hosting](https://www.hostinger.com/web-apps-hosting/nextjs-hosting).
- **Paket Hostinger yang dimiliki sekolah belum diketahui.** Bila paketnya Single/Premium
  (tanpa Node.js), aplikasi ini tidak dapat berjalan di sana tanpa upgrade.
- `vercel.json` (cron) **tidak berlaku** di Hostinger. Pengiriman buletin bertahap dan
  pembersihan data perlu dijadwalkan lewat cron hPanel atau layanan cron eksternal yang
  memanggil `/api/cron/newsletter` dengan header rahasia. Perilaku cron hPanel untuk
  aplikasi Node.js belum terverifikasi dari dokumentasi resmi; harus diuji.
- Database tetap di Supabase (terpisah dari Hostinger). Hostinger hanya menjalankan aplikasi.

## 7. Daftar kekurangan terhadap master prompt

| # | Kebutuhan | Status saat ini |
|---|-----------|-----------------|
| 1 | Identitas SMATRIK, logo & foto asli | Nama situs masih "SMA Negeri 3 Takalar"; **tidak ada aset logo/foto** di `public/` |
| 2 | Palet Modern Academic (Navy/Teal/Gold) | Palet berbeda (biru/emas); perlu diganti |
| 3 | Beranda lengkap (unggulan, program, prestasi, galeri, kalender, perpustakaan, Ruang Rasa) | Baru hero, berita terbaru, langganan |
| 4 | Portal berita editorial (kategori, cari, filter) | Baru daftar + pagination |
| 5 | CMS berita: rich-text, unggah gambar, kategori/tag, jadwal, persetujuan, pratinjau, arsip/pulihkan, riwayat | Hanya form teks biasa, status draf/terbit/arsip |
| 6 | Peran: Super Admin, Admin Website, Editor, Petugas Administrasi, Guru BK, Petugas Teknis | Hanya `admin`, `guru`, `siswa`, `guru_bk` |
| 7 | Halaman profil via CMS | Hardcoded |
| 8 | Galeri & prestasi | Belum ada |
| 9 | Kalender kegiatan | Belum ada |
| 10 | Tahun ajaran, semester, impor jadwal CSV/XLSX dengan pratinjau & laporan per baris | Belum ada (jadwal manual) |
| 11 | Arsip SK (PDF, metadata, masih berlaku/arsip) | Belum ada |
| 12 | Perpustakaan digital + tautan Portal Buku Kemendikdasmen | Belum ada |
| 13 | **Ruang Rasa & pelaporan bullying** | **Belum pernah dibangun** (master prompt menyebut "telah dirancang", tetapi tidak ada kode, tabel, atau spesifikasi di repo) |
| 14 | Penyimpanan file (gambar, PDF) | Belum ada |
| 15 | Backup & pemulihan terdokumentasi dan teruji | Belum ada |
| 16 | Deployment Hostinger | Belum ada konfigurasi/panduan |
| 17 | 13 dokumen panduan wajib | Baru sebagian (Google OAuth, email, peran, pengujian) |

## 8. Rencana implementasi bertahap

Setiap tahap: file yang diubah, risiko, dan cara uji dijelaskan dulu dan dikerjakan setelah disetujui.
Semua migrasi bersifat **aditif** (menambah tabel/kolom), tidak menghapus data.

| Tahap | Isi | Risiko utama |
|-------|-----|--------------|
| 2 ✅ | Design system Modern Academic, beranda & portal berita (pencarian, berita utama, pagination, artikel). Lihat `docs/DESIGN_SYSTEM.md` | Logo/foto resmi belum ada → monogram & pola netral; kategori menyusul di Tahap 3 (butuh skema) |
| 3 ✅ | CMS berita penuh: Supabase Storage untuk gambar, rich-text editor dengan sanitasi HTML, kategori/tag, alur draf → menunggu persetujuan → terjadwal/terbit → arsip, riwayat revisi, peran Editor & Admin Website | XSS dari rich-text (wajib sanitasi di server); migrasi peran harus kompatibel dengan akun lama |
| 4 ✅ | Profil sekolah (hero, logo, kontak, media sosial), halaman profil via CMS, program unggulan, galeri dengan konfirmasi izin foto, prestasi (saring tingkat/tahun), kalender kegiatan publik/internal, pengumuman publik. Lihat `docs/PANDUAN_MENGELOLA_HALAMAN.md` | Ukuran unggahan & kuota Storage; izin publikasi foto siswa tetap tanggung jawab penerbit |
| 5 ✅ | Peran Petugas Administrasi; tahun ajaran/semester (satu aktif); impor jadwal CSV/XLSX dengan pratinjau, laporan per baris, deteksi duplikat & bentrok, tanpa menimpa data lama, dan pembatalan per impor; arsip SK PDF (bucket privat, wajib konfirmasi pemeriksaan); perpustakaan digital. Lihat `docs/PANDUAN_ADMINISTRASI_SEKOLAH.md` | Parsing XLSX di server (dibatasi 2 MB/2.000 baris, hanya staf); SK & PDF tetap harus diperiksa manusia |
| **RR** | **Ruang Rasa** (lihat bagian 9): menunggu keputusan kebijakan sekolah | Data sangat sensitif (anak, kekerasan); salah desain berdampak serius |
| 6 ✅ | Panduan database (peta tabel, relasi, migrasi, kueri aman, prosedur standar) & operasional admin (rutinitas, checklist tahun ajaran, insiden); halaman Status Sistem & Log Aktivitas; log perubahan konten otomatis. Lihat `docs/README.md` | Prosedur manual tetap bergantung pada disiplin petugas; dicatat di buku log |
| 7 | Backup/pemulihan, audit keamanan, pengujian akhir | Backup Supabase tergantung paket; harus diuji, bukan diasumsikan |
| 8 | Dokumentasi final & deployment Hostinger | Butuh akses paket Hostinger yang mendukung Node.js |

## 9. Ruang Rasa: keputusan yang dibutuhkan sebelum dibangun

Usulan desain aman (untuk disetujui atau diubah):

- Formulir laporan **tanpa login**; pelapor boleh anonim. Tidak menyimpan IP mentah
  (hanya hash berkunci untuk rate limit).
- Tabel laporan terpisah di skema/RLS khusus; **hanya Guru BK yang ditugaskan** yang
  dapat membaca. Admin website, editor, dan service role untuk buletin tidak punya jalur.
- Pelapor mendapat **kode referensi + PIN rahasia** (keduanya diperlukan; PIN disimpan
  sebagai hash) untuk melihat status/membalas.
- Setiap pembukaan laporan dicatat di log akses (siapa, kapan), tanpa isi laporan di log.
- Notifikasi ke Guru BK hanya berisi "ada laporan baru" + tautan ke dashboard, tanpa isi.
- Retensi otomatis sesuai kebijakan sekolah (misalnya diarsipkan setelah kasus selesai dan
  dihapus setelah N bulan).

Yang perlu ditentukan sekolah: siapa saja petugas yang boleh membaca, masa retensi,
kanal notifikasi (email saja atau WhatsApp dan penyedianya), prosedur darurat (misalnya
nomor kontak bila ada ancaman keselamatan), dan teks persetujuan untuk siswa di bawah umur.
