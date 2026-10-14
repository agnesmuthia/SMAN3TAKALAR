# Serah Terima Website Sekolah

Ringkasan akhir pengembangan tahap 1–8 untuk kepala sekolah, Super Admin, dan petugas
teknis. Dokumen rinci untuk setiap topik ada di [indeks dokumentasi](README.md).

## 1. Apa yang sudah dibangun

### Untuk pengunjung (tanpa login)
| Halaman | Isi |
|---------|-----|
| Beranda | Hero, pengumuman, berita terbaru, program, prestasi, agenda, galeri, perpustakaan, langganan. Bagian tanpa data otomatis disembunyikan |
| Berita | Pencarian, kategori, tag, berita utama, halaman artikel & bagikan |
| Profil | Halaman profil (visi-misi, sejarah, dll.), program unggulan, kontak |
| Pengumuman | Pengumuman berstatus publik |
| Galeri, Prestasi, Kalender | Album foto (dengan izin publikasi), prestasi per tingkat/tahun, kalender bulanan |
| Perpustakaan | Koleksi sekolah + Portal Buku Kemendikdasmen |
| Arsip SK | SK publik yang sudah diperiksa (unduh lewat tautan sementara) |
| Langganan berita | Daftar email dengan konfirmasi ganda; berhenti tanpa login |

### Untuk warga sekolah (login + verifikasi admin)
- Masuk dengan email/kata sandi atau Google. Login **tidak** memberi peran otomatis;
  guru/siswa mengajukan verifikasi dan admin menyetujui.
- **Guru:** jadwal mengajar, kelola tugas & materi (teks + tautan), pengumuman internal.
- **Siswa:** jadwal kelas (semester aktif), tugas & materi kelasnya, pengumuman.
- **Guru BK:** kerangka dashboard + pengumuman (modul konseling belum ada).
- Kegiatan kalender, SK, dan koleksi perpustakaan bertanda **internal** hanya terlihat
  oleh warga sekolah yang aktif.

### Untuk pengelola (`/admin`)
| Peran | Menu |
|-------|------|
| Editor | Berita: menulis & mengirim untuk persetujuan |
| Admin Website | Berita (menyetujui/menjadwalkan/arsip, kategori), Pengumuman, Halaman, Program, Galeri, Prestasi, Kalender, Perpustakaan, Profil Sekolah |
| Petugas Administrasi | Tahun Ajaran & Semester, Jadwal & impor CSV/XLSX, Arsip SK, Perpustakaan |
| Super Admin | Semua menu, plus Verifikasi, Pengguna & peran, Langganan Berita, Pengaturan, **Status Sistem**, **Log Aktivitas** |

### Untuk petugas teknis
- Skema database (10 migrasi, semuanya aditif) dengan Row Level Security di semua tabel.
- Skrip backup/pulih database & Storage terenkripsi dengan pengaman produksi.
- Smoke test pasca-deploy, endpoint `/api/health`, penjadwal cron (GitHub Actions).
- CI: lint, typecheck, unit test, build, uji database, uji backup & pemulihan.

## 2. Status: aktif vs. menunggu konfigurasi

| Bagian | Status |
|--------|--------|
| Kode semua fitur di atas | **Selesai** dan diuji otomatis (bagian 4) |
| Proyek Supabase produksi | **Belum dibuat**. Semua fitur butuh proyek ini |
| Hosting Hostinger | **Belum dipasang**; paket sekolah belum dikonfirmasi (butuh Business/Cloud) |
| Login Google | Kode selesai; **aktif setelah** OAuth Google & provider Supabase dikonfigurasi |
| Email (konfirmasi akun, reset sandi, buletin) | Kode selesai; **aktif setelah** domain pengirim diverifikasi di Resend & SMTP kustom Supabase diatur |
| Backup mandiri | Skrip selesai & diuji lokal; **uji pertama di Supabase sungguhan belum dilakukan** |
| Penjadwal cron | Workflow siap; **aktif setelah** `CRON_URL` & `CRON_SECRET` diisi di GitHub |

Urutan pemasangan: `PANDUAN_DEPLOYMENT_HOSTINGER.md` (dengan checklist go-live).

## 3. Keputusan yang masih ditunggu dari sekolah

| Topik | Yang perlu diputuskan |
|-------|-----------------------|
| Identitas | Nama tampil (SMA Negeri 3 Takalar / "SMATRIK"), **logo resmi & foto** yang boleh dipakai |
| Infrastruktur | Paket Hostinger; paket Supabase (menentukan backup bawaan); domain |
| Petugas | Siapa Super Admin utama & cadangan, Admin Website, Petugas Administrasi, petugas teknis |
| **Ruang Rasa** (pelaporan/konseling) | Siapa yang boleh membaca laporan, masa simpan, kanal notifikasi, prosedur darurat, persetujuan untuk siswa di bawah umur (`AUDIT_DAN_RENCANA.md` §9). **Belum dibangun** sampai kebijakan ini ada |
| Kenaikan kelas massal | Apakah perlu alat untuk mengubah kelas/menonaktifkan lulusan secara massal (saat ini satu per satu) |
| MFA admin | Apakah verifikasi dua langkah untuk akun admin website dibuat di tahap lanjutan |
| Data induk NIP/NIS | Apakah sinyal verifikasi dari data induk dipakai (butuh impor oleh petugas berwenang) |

## 4. Bukti pengujian (saat serah terima)

| Jenis | Jumlah | Perintah |
|-------|--------|----------|
| Unit test (logika, keamanan statis, CSP, impor, PDF, backup Storage) | 196 | `npm test` |
| Asersi database (RLS per peran, alur, hak akses, operasional) | 234 | `npm run test:db` |
| Kueri di panduan database dijalankan dalam mode baca-saja | 12 | `npm run test:db` |
| Backup terenkripsi → pulih → isi 38 tabel identik + pengaman | 1 skenario menyeluruh | `npm run test:backup` |
| Smoke test (halaman, akses, header, health) | 36 | `npm run smoke -- <URL>` |
| Dependensi produksi (`npm audit`) | 0 kerentanan | `npm audit --omit=dev` |

Pengujian tampilan dilakukan di browser (Playwright) memakai server Supabase **tiruan**
dengan data berlabel "Contoh". **Belum ada pengujian end-to-end dengan Supabase,
Google, Resend, dan Hostinger sungguhan**; daftar ujinya ada di
`PANDUAN_DEPLOYMENT_HOSTINGER.md` §8 dan `google-oauth.md` §6.

## 5. Prinsip yang dijaga selama pengembangan

- Tidak ada data palsu yang tampil sebagai informasi resmi; bagian tanpa data disembunyikan.
- Tidak ada tombol palsu; setiap tombol menjalankan tindakan nyata yang diuji.
- Tidak ada endpoint SQL bebas; admin tidak perlu membuka database.
- Rahasia hanya di environment variables; service role tidak pernah ke browser.
- Migrasi hanya menambah; tidak ada penghapusan data tanpa persetujuan.
- Pemulihan ke produksi diblokir skrip kecuali dengan konfirmasi eksplisit.

## 6. Kontak & kepemilikan (diisi sekolah)

| Peran | Nama | Kontak resmi |
|-------|------|--------------|
| Penanggung jawab (kepala sekolah) | | |
| Super Admin utama | | |
| Super Admin cadangan | | |
| Petugas teknis | | |
| Pemilik akun Supabase / Hostinger / GitHub / Resend / Google Cloud | | |
