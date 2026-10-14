# Panduan Operasional Admin

Pegangan kerja rutin untuk pengelola website sekolah: **Super Admin**, **Admin Website**,
**Editor**, dan **Petugas Administrasi**. Panduan teknis per fitur ada di dokumen lain
(lihat [README dokumentasi](README.md)); dokumen ini menjawab *kapan* dan *siapa*
melakukan apa.

## 1. Pembagian tugas

| Peran | Tanggung jawab utama | Panduan rinci |
|-------|----------------------|---------------|
| Super Admin | Akun & peran, verifikasi guru/siswa, langganan berita, pengaturan, Status Sistem, Log Aktivitas | `PANDUAN_ADMIN_WEBSITE.md`, `peran-dan-verifikasi.md` |
| Admin Website | Menyetujui & menerbitkan berita, pengumuman, halaman, galeri, prestasi, kalender, profil sekolah, perpustakaan | `PANDUAN_MENGELOLA_BERITA.md`, `PANDUAN_MENGELOLA_HALAMAN.md` |
| Editor | Menulis berita dan mengirimnya untuk persetujuan | `PANDUAN_MENGELOLA_BERITA.md` |
| Petugas Administrasi | Tahun ajaran & semester, jadwal & impor, arsip SK, perpustakaan | `PANDUAN_ADMINISTRASI_SEKOLAH.md` |
| Petugas teknis (di luar aplikasi) | Database, migrasi, backup, kunci rahasia, hosting | `PANDUAN_DATABASE.md` |

Prinsip:
- **Satu orang, satu akun.** Jangan berbagi akun admin. Setiap tindakan tercatat atas nama
  pemilik akun.
- **Minimal dua Super Admin aktif** (utama dan cadangan) agar akses tidak terkunci.
- **Hak secukupnya.** Berikan peran staf sesuai tugas, dan cabut ketika tugas selesai.
- Semua konten publik adalah informasi **resmi** sekolah: periksa kebenaran, izin foto, dan
  data pribadi sebelum menerbitkan.

## 2. Rutinitas

### Harian (hari sekolah)
| Siapa | Tugas | Di mana |
|-------|-------|---------|
| Admin Website | Tinjau berita "Menunggu persetujuan": setujui, jadwalkan, atau kembalikan dengan catatan | `/admin/berita?status=review` |
| Admin Website | Terbitkan pengumuman yang dibutuhkan hari itu | `/admin/pengumuman` |
| Super Admin | Tinjau pengajuan verifikasi akun guru/siswa | `/admin/verifikasi` |

Kotak **Perlu tindakan** di halaman Ringkasan (`/admin`) merangkum pekerjaan yang menunggu.

### Mingguan
| Siapa | Tugas | Di mana |
|-------|-------|---------|
| Super Admin | Buka **Status Sistem** dan selesaikan peringatan | `/admin/status` |
| Super Admin | Periksa email gagal/terpental, lalu rapikan daftar pelanggan bila perlu | `/admin/langganan` |
| Admin Website | Perbarui kalender kegiatan minggu depan | `/admin/kalender` |
| Admin Website | Arsipkan pengumuman/berita yang sudah tidak relevan | `/admin/berita`, `/admin/pengumuman` |
| Petugas Administrasi | Putuskan pratinjau impor yang tertunda (dihapus otomatis setelah 7 hari) | `/admin/jadwal/impor` |

### Bulanan
| Siapa | Tugas |
|-------|-------|
| Super Admin | Tinjau **Log Aktivitas** untuk perubahan yang tidak dikenali (`/admin/log`) |
| Super Admin | Tinjau daftar pengguna berperan staf; cabut yang tidak lagi bertugas (`/admin/pengguna`) |
| Petugas teknis | Periksa kuota database/storage dan log error (`PANDUAN_DATABASE.md` §11) |
| Admin Website | Periksa halaman profil, kontak, dan tautan media sosial masih benar |

### Per semester
Lihat checklist bagian 3 dan 4. Ditambah: petugas teknis menguji pemulihan backup dan
membersihkan file yatim (`PANDUAN_DATABASE.md` §10.7).

## 3. Checklist awal tahun ajaran

Urutan disarankan (2–3 minggu sebelum hari pertama sekolah):

1. **Petugas Administrasi**: buat tahun ajaran baru beserta semester Ganjil & Genap
   (`/admin/tahun-ajaran`). Jangan aktifkan dulu.
2. **Super Admin**: verifikasi akun siswa baru (kelas X) dan guru baru (`/admin/verifikasi`).
3. **Super Admin**: perbarui **kelas siswa** yang naik kelas (`/admin/pengguna`, kolom kelas).
   Tulis kelas persis sama dengan jadwal (mis. `XI-2`).
4. **Petugas Administrasi**: impor jadwal ke semester Ganjil baru dari XLSX/CSV
   (`/admin/jadwal/impor`). Selesaikan semua baris bermasalah.
5. **Petugas Administrasi**: pada hari pertama semester klik **Jadikan aktif** pada
   semester Ganjil. Siswa dan guru langsung melihat jadwal baru.
6. **Petugas teknis/Super Admin**: jalankan kueri "kelas di jadwal yang tidak punya siswa"
   (`PANDUAN_DATABASE.md` §9) untuk menemukan salah tulis nama kelas.
7. **Admin Website**: perbarui kalender akademik, halaman profil (struktur organisasi,
   wali kelas bila dipublikasikan), dan pengumuman awal tahun.
8. **Petugas Administrasi**: unggah SK pembagian tugas yang sudah ditandatangani ke Arsip
   SK; pilih **Internal** bila memuat data pribadi.

## 4. Checklist akhir tahun ajaran / semester

1. **Petugas Administrasi**: pastikan semester berikutnya sudah dibuat dan jadwalnya
   diimpor, lalu aktifkan pada hari pertama semester baru.
2. **Super Admin**: **nonaktifkan** akun siswa yang lulus dan guru/staf yang pindah
   (`/admin/pengguna`). Jangan menghapus akun (data milik akun tetap dibutuhkan).
3. **Super Admin**: cabut peran staf orang yang tidak lagi bertugas.
4. **Petugas Administrasi**: ubah status SK yang sudah tidak berlaku menjadi **Arsip**.
5. **Admin Website**: arsipkan berita/pengumuman kedaluwarsa; pastikan galeri kegiatan
   semester ini sudah memiliki konfirmasi izin foto.
6. **Petugas teknis**: buat dan uji backup akhir tahun (panduan backup, Tahap 7).

## 5. Serah terima petugas

Saat petugas berganti tugas:
1. Petugas baru mendaftar akun sendiri; Super Admin memberi peran yang sama.
2. Cabut peran staf petugas lama; nonaktifkan akunnya bila ia meninggalkan sekolah.
3. Bila petugas lama memegang akses dasbor Supabase, Resend, GitHub, atau hosting:
   hapus aksesnya dan **rotasi kunci** yang pernah ia ketahui (`PANDUAN_DATABASE.md` §10.8).
4. Serahkan buku log operasional dan daftar akun layanan pihak ketiga (tanpa kata sandi;
   gunakan pengelola kata sandi sekolah).

## 6. Penanganan insiden

| Kejadian | Langkah segera | Tindak lanjut |
|----------|----------------|---------------|
| **Konten salah terbit** (berita/pengumuman/foto keliru atau melanggar izin) | Admin Website: arsipkan berita, hapus centang "Tampilkan", atau hapus foto | Bila sudah masuk buletin email, kirim ralat lewat berita baru; catat di buku log |
| **Data pribadi terpublikasi** (NIK, nilai, foto tanpa izin, SK internal ditandai publik) | Sembunyikan segera (arsip/ubah visibilitas ke Internal) | Laporkan ke kepala sekolah; tinjau `/admin/log` siapa yang menerbitkan; evaluasi apakah pihak terdampak perlu diberi tahu |
| **Akun admin/staf diduga dibobol** | Super Admin lain: nonaktifkan akun itu (`/admin/pengguna`) | Pemilik mengganti kata sandi/mengamankan akun Google; tinjau `/admin/log` untuk perubahan mencurigakan, lalu perbaiki konten; aktifkan kembali setelah aman |
| **Semua Super Admin terkunci** | Hubungi petugas teknis | `PANDUAN_DATABASE.md` §10.2 |
| **Kunci rahasia bocor** (mis. terunggah ke chat/GitHub) | Petugas teknis: rotasi kunci | `PANDUAN_DATABASE.md` §10.8; periksa log Supabase |
| **Banyak pendaftaran/langganan spam** | Jangan verifikasi akun yang tidak dikenal; pelanggan spam dapat dianonimkan | Laporkan ke petugas teknis untuk memeriksa rate limit & log |
| **Email buletin banyak terpental** | Hentikan kampanye yang berjalan | Periksa domain pengirim & webhook Resend (`langganan-berita-email.md`) |
| **Jadwal salah setelah impor** | Petugas Administrasi: **Batalkan impor ini** di halaman impor | Perbaiki file, impor ulang |
| **Website tidak bisa dibuka / error** | Catat waktu dan pesan error; buka `/admin/status` bila bisa | Hubungi petugas teknis (log hosting & Supabase) |

Setiap insiden dicatat di buku log operasional: tanggal, kejadian, langkah, dan orang
yang menangani.

## 7. Eskalasi

| Masalah | Hubungi |
|---------|---------|
| Konten, persetujuan berita | Admin Website → Kepala sekolah/humas |
| Akun, peran, verifikasi | Super Admin |
| Jadwal, SK, tahun ajaran | Petugas Administrasi |
| Error teknis, database, hosting, kunci rahasia | Petugas teknis |
| Data pribadi atau keamanan | Super Admin + Kepala sekolah (segera) |

Isi nama dan kontak resmi masing-masing di buku log operasional sekolah, **bukan** di
repository.

## 8. Hal yang tidak dilakukan lewat website

- Menjalankan perintah SQL (tidak tersedia, dan memang tidak disediakan).
- Mengubah struktur database atau memulihkan backup (petugas teknis, dengan persetujuan).
- Mengatur Google Login dan domain email (dasbor Supabase/Resend oleh petugas teknis).
- Menyimpan laporan Ruang Rasa (modul belum dibangun; menunggu kebijakan sekolah).
