# Panduan Database (versi awal)

Database proyek ini adalah **PostgreSQL yang dikelola Supabase**. Proyek **tidak**
memakai MySQL/MariaDB Hostinger, jadi hPanel dan phpMyAdmin **tidak** dipakai untuk data
website.

> Proyek Supabase produksi belum tercatat di repository. Bagian bertanda **(isi nanti)**
> dilengkapi setelah proyek dibuat. Jangan menulis kata sandi, token, atau service role
> key di dokumen ini.

## 1. Siapa memakai apa

| Peran | Alat | Untuk |
|-------|------|-------|
| Admin website / editor | **Dashboard website** (`/admin`) | Berita, pengumuman, jadwal, langganan, pengguna |
| Petugas teknis database | **Supabase Dashboard** | Memeriksa data & relasi, migrasi, kebijakan RLS, log, backup |
| Guru, siswa, Guru BK | Dashboard website (`/dashboard/...`) | Tidak pernah mengakses database langsung |

Admin konten **tidak perlu** membuka Supabase untuk pekerjaan rutin. Akses Supabase
Dashboard hanya diberikan kepada petugas teknis (undang lewat **Organization → Members**
dengan peran seminimal mungkin), terpisah dari akun admin website.

## 2. Membuka Supabase Dashboard

1. Buka <https://supabase.com/dashboard> dan masuk dengan akun petugas teknis.
2. Pilih organisasi sekolah, lalu proyek **(isi nanti: nama proyek)**.
3. Menu yang dipakai:
   - **Table Editor**: melihat isi tabel (mode baca; hindari mengubah data di sini).
   - **Database → Tables / Schema Visualizer**: struktur kolom & relasi.
   - **Policies** (menu Database atau Authentication, tergantung versi dasbor): kebijakan RLS tiap tabel. Semua tabel wajib berstatus "RLS enabled".
   - **Authentication → Users**: daftar akun login.
   - **Logs**: log API, Auth, dan Postgres untuk menelusuri error.
   - **Database → Backups**: status backup (ketersediaan & frekuensi tergantung paket Supabase; periksa di sana, jangan diasumsikan).
   - **SQL Editor**: hanya untuk prosedur terdokumentasi (mis. membuat admin pertama).

## 3. Tabel dan fungsinya

| Tabel | Isi | Boleh diubah langsung? |
|-------|-----|------------------------|
| `profiles` | Peran & status akun | **Tidak**; gunakan `/admin/pengguna` |
| `verification_requests` | Pengajuan guru/siswa (memuat NIP/NIS) | Tidak; gunakan `/admin/verifikasi` |
| `school_roster` | Data induk NIP/NIS | Impor CSV oleh petugas berwenang |
| `news` | Berita (isi HTML yang sudah disanitasi di `content_html`) | Tidak; gunakan `/admin/berita` |
| `news_categories`, `news_tags`, `news_tag_links` | Kategori & tag berita | Tidak; gunakan CMS |
| `news_revisions` | Riwayat perubahan berita (otomatis) | Hanya dibaca |
| `staff_roles` | Peran CMS (Editor, Admin Website) | Tidak; gunakan `/admin/pengguna` |
| `site_profile` | Profil sekolah: hero, logo, kontak, media sosial (satu baris) | Tidak; gunakan `/admin/profil-sekolah` |
| `site_pages` | Halaman profil (HTML tersanitasi) | Tidak; gunakan `/admin/halaman` |
| `school_programs` | Program unggulan | Tidak; gunakan `/admin/program` |
| `gallery_albums`, `gallery_photos` | Album & foto galeri (album terbit wajib punya konfirmasi izin) | Tidak; gunakan `/admin/galeri` |
| `achievements` | Prestasi | Tidak; gunakan `/admin/prestasi` |
| `calendar_events` | Kalender kegiatan (publik/internal) | Tidak; gunakan `/admin/kalender` |
| `announcements`, `announcement_reads` | Pengumuman (publik & internal) | Tidak; gunakan `/admin/pengumuman` |
| `schedule_entries` | Jadwal pelajaran (kolom `semester_id`, `import_batch_id`) | Tidak; gunakan `/admin/jadwal` |
| `academic_years`, `semesters` | Tahun ajaran & semester (satu aktif) | Tidak; gunakan `/admin/tahun-ajaran` |
| `schedule_import_batches` | Pratinjau & riwayat impor jadwal (laporan per baris) | Tidak; gunakan `/admin/jadwal/impor` |
| `decrees` | Metadata arsip SK (file di bucket privat `documents`) | Tidak; gunakan `/admin/arsip-sk` |
| `library_items` | Koleksi perpustakaan digital | Tidak; gunakan `/admin/perpustakaan` |
| `assignments` | Tugas & materi guru | Tidak; dikelola guru |
| `newsletter_*` | Data langganan email (memuat alamat email) | **Tidak**; gunakan `/admin/langganan` |
| `app_settings` | Pengaturan aplikasi | Tidak; gunakan `/admin/pengaturan` |
| `admin_audit_log` | Catatan tindakan admin | Hanya dibaca |
| `rate_limit_hits` | Anti-spam (sementara) | Dibersihkan otomatis |

## 4. Penyimpanan file (Supabase Storage)

- Bucket `news-images` menyimpan gambar berita (publik untuk dibaca lewat URL, maks. 5 MB,
  hanya JPG/PNG/WebP). Lokasi: **Storage → news-images**.
- Bucket `site-media` menyimpan logo, gambar hero, foto galeri, prestasi, dan program
  (aturan sama: publik dibaca, maks. 5 MB, JPG/PNG/WebP).
- Bucket **`documents` bersifat PRIVAT** (maks. 10 MB, hanya PDF): file SK (`sk/…`) dan PDF
  perpustakaan (`perpustakaan/…`). Jangan mengubahnya menjadi publik. Unduhan dilayani lewat
  tautan sementara 60 detik setelah aplikasi memeriksa hak baca.
- Unggahan hanya lewat CMS (server memeriksa izin dan isi file). Tidak ada policy tulis
  untuk browser.
- Nama file acak per tahun/bulan (mis. `2026/10/<acak>.jpg`).
- Menghapus berita **tidak** otomatis menghapus file gambarnya; pembersihan file yatim
  dilakukan petugas teknis secara berkala (prosedur di panduan backup, Tahap 7).

## 5. Migrasi

- Semua perubahan struktur ada di `supabase/migrations/` dan masuk lewat GitHub (bukan
  diedit di Table Editor).
- Diuji dulu dengan `npm run test:db`, lalu diterapkan dengan
  `npx supabase link --project-ref <project-ref>` dan `npx supabase db push`.
- Sebelum menerapkan migrasi ke produksi: pastikan ada backup terbaru (lihat panduan
  backup, menyusul di Tahap 7).

## 6. Larangan

- Jangan menjalankan `DROP`, `TRUNCATE`, `DELETE` tanpa `WHERE`, atau mematikan RLS.
- Jangan mengubah kolom `role`/`status` langsung, kecuali prosedur admin pertama.
- Jangan menyalin data pribadi (email pelanggan, NIP/NIS) ke spreadsheet pribadi.
- Jangan membagikan service role key atau kata sandi database. Kunci hanya disimpan
  di environment variables hosting.
- Website sengaja **tidak** menyediakan fitur menjalankan SQL bebas dari browser.
