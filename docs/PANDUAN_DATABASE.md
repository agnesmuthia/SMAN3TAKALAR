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
| `news` | Berita | Tidak; gunakan `/admin/berita` |
| `announcements`, `announcement_reads` | Pengumuman internal | Tidak; gunakan `/admin/pengumuman` |
| `schedule_entries` | Jadwal pelajaran | Tidak; gunakan `/admin/jadwal` |
| `assignments` | Tugas & materi guru | Tidak; dikelola guru |
| `newsletter_*` | Data langganan email (memuat alamat email) | **Tidak**; gunakan `/admin/langganan` |
| `app_settings` | Pengaturan aplikasi | Tidak; gunakan `/admin/pengaturan` |
| `admin_audit_log` | Catatan tindakan admin | Hanya dibaca |
| `rate_limit_hits` | Anti-spam (sementara) | Dibersihkan otomatis |

## 4. Migrasi

- Semua perubahan struktur ada di `supabase/migrations/` dan masuk lewat GitHub (bukan
  diedit di Table Editor).
- Diuji dulu dengan `npm run test:db`, lalu diterapkan dengan
  `npx supabase link --project-ref <project-ref>` dan `npx supabase db push`.
- Sebelum menerapkan migrasi ke produksi: pastikan ada backup terbaru (lihat panduan
  backup, menyusul di Tahap 7).

## 5. Larangan

- Jangan menjalankan `DROP`, `TRUNCATE`, `DELETE` tanpa `WHERE`, atau mematikan RLS.
- Jangan mengubah kolom `role`/`status` langsung, kecuali prosedur admin pertama.
- Jangan menyalin data pribadi (email pelanggan, NIP/NIS) ke spreadsheet pribadi.
- Jangan membagikan service role key atau kata sandi database. Kunci hanya disimpan
  di environment variables hosting.
- Website sengaja **tidak** menyediakan fitur menjalankan SQL bebas dari browser.
