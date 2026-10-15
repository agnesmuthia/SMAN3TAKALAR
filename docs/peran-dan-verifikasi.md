# Peran, Verifikasi, dan Akses

## Peran

| Peran | Cara mendapatkan | Akses |
|-------|------------------|-------|
| *(tanpa peran, pending)* | Otomatis untuk setiap akun baru (email atau Google) | Halaman publik, `/akun` |
| Siswa | Mengajukan verifikasi → disetujui admin | `/dashboard/siswa`, berita internal |
| Guru | Mengajukan verifikasi → disetujui admin | `/dashboard/guru`, berita internal |
| Guru BK | **Hanya** ditetapkan admin di `/admin/pengguna` | `/dashboard/bk`; laporan Ruang Rasa hanya bila ditugaskan |
| Admin | **Hanya** ditetapkan admin lain (atau bootstrap SQL pertama) | `/admin/*` |

Aturan yang ditegakkan di database (bukan hanya di tampilan):

- Trigger `handle_new_auth_user` membuat profil `role = NULL, status = 'pending'` dan
  **mengabaikan** metadata OAuth/pendaftaran.
- Pengguna tidak punya hak `UPDATE` pada `profiles`; peran/status hanya berubah lewat
  fungsi `admin_review_verification` dan `admin_set_user_access` yang memeriksa
  `is_admin()`.
- `submit_verification_request` hanya menerima `guru` atau `siswa`.
- Admin aktif terakhir tidak dapat menurunkan/menonaktifkan dirinya.
- Akun `disabled` kehilangan semua akses RLS seketika, sesi Supabase Auth diblokir
  (`ban_duration`), dan halaman privat mengeluarkannya.

### Peran staf CMS (tambahan)

| Peran staf | Diberikan oleh | Kewenangan |
|------------|----------------|------------|
| Editor | Super Admin di `/admin/pengguna` | Menulis berita sendiri, mengirim untuk persetujuan |
| Admin Website | Super Admin di `/admin/pengguna` | Semua berita: menyetujui, menerbitkan/menjadwalkan, mengarsipkan, kategori; pengumuman; konten situs (profil sekolah, halaman, program, galeri, prestasi, kalender) |

| Petugas Administrasi | Super Admin di `/admin/pengguna` (bukan untuk akun siswa) | Tahun ajaran & semester, jadwal & impor CSV/XLSX, arsip SK (termasuk SK internal), perpustakaan |

Peran staf hanya berlaku untuk akun **aktif** dan otomatis tidak berlaku bila akun
dinonaktifkan. Pemberiannya dicatat di `admin_audit_log`.

## Alur verifikasi

1. Pengguna mendaftar (email atau Google) → `/akun/lengkapi-profil`.
2. Mengisi peran (guru/siswa), nama sesuai data sekolah, NIP/NIS, kelas (siswa).
3. Sistem mencatat **sinyal bantu** untuk admin:
   - `roster_match`: NIP/NIS + nama cocok dengan tabel `school_roster`.
   - `email_domain_match`: email berakhiran domain Google Workspace sekolah (bila diatur).
4. Admin meninjau di `/admin/verifikasi` dan menyetujui/menolak. Sinyal di atas tidak
   pernah menyetujui secara otomatis.

## Membuat admin pertama (sekali saja)

1. Daftar akun melalui situs (email atau Google) dengan email pengelola resmi.
2. Di dasbor Supabase → **SQL Editor**, jalankan (ganti emailnya):
   ```sql
   update public.profiles
      set role = 'admin', status = 'active', verified_at = now()
    where id = (select id from auth.users where email = 'pengelola@sman3takalar.sch.id');
   ```
3. Admin berikutnya ditetapkan dari `/admin/pengguna`.

## Mengisi data induk (`school_roster`)

Data NIP/NIS bersifat pribadi. Impor hanya oleh admin berwenang melalui dasbor
Supabase (**Table Editor → school_roster → Import CSV**) dengan kolom
`kind` (`guru`/`siswa`), `identifier`, `full_name`, `class_name`. Hapus file CSV
setelah impor. Tabel ini hanya dapat dibaca admin (RLS).

## Dashboard per peran

| Peran | Halaman | Isi |
|-------|---------|-----|
| Siswa | `/dashboard/siswa`, `/jadwal`, `/tugas` | Jadwal kelasnya, tugas & materi **terbit** untuk kelasnya, pengumuman |
| Guru | `/dashboard/guru`, `/jadwal`, `/tugas` | Jadwal mengajarnya, kelola tugas & materi **miliknya**, pengumuman |
| Guru BK | `/dashboard/bk`, `/dashboard/bk/ruang-rasa` | Ringkasan, pengumuman, dan (bila ditugaskan) laporan Ruang Rasa. Belum ada modul konseling lain |
| Semua anggota aktif | `/dashboard/pengumuman` | Pengumuman yang ditujukan ke perannya, penanda sudah dibaca |
| Admin | `/admin/pengguna` | Kelola kelas siswa |
| Admin & Petugas Administrasi | `/admin/tahun-ajaran`, `/admin/jadwal`, `/admin/arsip-sk` | Semester aktif, jadwal & impor, arsip SK |
| Admin & Admin Website | `/admin/pengumuman` | Kelola pengumuman (termasuk audiens **Publik** yang tampil di website) |

Catatan operasional:

- **Kelas siswa** disalin dari pengajuan verifikasi saat admin menyetujui; admin dapat mengubahnya
  di `/admin/pengguna`. Jadwal dan tugas dicocokkan dengan **teks kelas yang sama persis**
  (mis. `X-1`), jadi gunakan penulisan yang konsisten.
- **Tugas & materi** hanya berisi teks dan tautan https (belum ada unggah file). Jangan
  menaruh data pribadi siswa di dalamnya.
- Pengumuman internal, jadwal, dan tugas tidak punya hubungan dengan modul berita/buletin
  email; isinya tidak pernah masuk buletin.
- Seluruh pembatasan baca/tulis ditegakkan oleh RLS (lihat `supabase/migrations/20261015000100_dashboard_peran.sql`
  dan `supabase/tests/11_dashboard.sql`).

## Ruang Rasa (petugas)

Guru BK **tidak otomatis** dapat membaca laporan Ruang Rasa. Super Admin menugaskan akun
Guru BK aktif di **Admin → Ruang Rasa**; hanya akun yang ditugaskan yang dapat membuka
laporan (dashboard BK → Ruang Rasa). Super Admin, Admin Website, Editor, dan Petugas
Administrasi tidak punya jalur membaca isi laporan. Detail: `PANDUAN_RUANG_RASA.md`.
