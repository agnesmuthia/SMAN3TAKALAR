# Panduan Admin Website

Panduan dasar untuk petugas yang mengelola website sekolah melalui dashboard.

## 1. Alamat dashboard

| Halaman | Alamat |
|---------|--------|
| Masuk | `https://<alamat-website>/masuk` |
| Dashboard admin/CMS | `https://<alamat-website>/admin` |
| Manajemen Berita | `https://<alamat-website>/admin/berita` |

Alamat website produksi belum tercatat di repository; ganti `<alamat-website>` dengan
domain resmi setelah website online.

## 2. Masuk dan keluar

1. Buka halaman **Masuk**.
2. Pilih **Lanjutkan dengan Google** atau isi email dan kata sandi.
3. Setelah masuk:
   - Super Admin diarahkan ke `/admin`.
   - Guru yang juga Editor/Admin Website diarahkan ke dashboard guru; klik **CMS Berita**
     di header untuk membuka CMS.
4. Untuk keluar, klik **Keluar** di header. Selalu keluar bila memakai komputer bersama.

Kata sandi tidak pernah ditulis di dokumentasi ini dan tidak boleh dibagikan.

## 3. Peran dan kewenangan

| Peran | Diberikan oleh | Dapat mengakses |
|-------|----------------|-----------------|
| Super Admin (`admin`) | Admin pertama via SQL (sekali), selanjutnya Super Admin lain | Semua menu admin |
| Admin Website | Super Admin (Pengguna → CMS) | Ringkasan, Berita (termasuk menerbitkan & kategori), Pengumuman, Halaman, Program, Galeri, Prestasi, Kalender, Profil Sekolah |
| Petugas Administrasi | Super Admin (Pengguna → Peran staf) | Ringkasan, Tahun Ajaran, Jadwal & impor, Arsip SK, Perpustakaan |
| Editor | Super Admin (Pengguna → CMS) | Ringkasan, Berita (menulis & mengirim untuk persetujuan) |
| Guru / Siswa | Admin melalui verifikasi | Dashboard guru/siswa, tanpa akses admin |
| Guru BK | Super Admin | Dashboard BK |

Menu admin yang tidak sesuai kewenangan tidak ditampilkan, dan server tetap menolak
akses walaupun alamatnya diketik langsung. Admin website **tidak** mendapat akses ke
database; akses database hanya untuk petugas teknis (lihat `docs/PANDUAN_DATABASE.md`).

### Memastikan peran akun

- Buka **Akun** (`/akun`): tampil status dan peran dasar.
- Halaman **Ringkasan** admin menampilkan "Peran: Super Admin / Admin Website / Editor".

## 4. Tidak bisa masuk?

| Gejala | Penyelesaian |
|--------|--------------|
| "Email atau kata sandi salah" | Gunakan **Lupa kata sandi?** di halaman Masuk. Akun Google tidak punya kata sandi; gunakan tombol Google. |
| "Akun Anda dinonaktifkan" | Hubungi Super Admin. |
| Setelah masuk diarahkan ke "Lengkapi profil"/"Menunggu verifikasi" | Akun belum diverifikasi admin. Tunggu persetujuan. |
| Menu Berita tidak muncul | Akun belum diberi peran Editor/Admin Website. Minta ke Super Admin. |
| "Anda tidak memiliki akses ke halaman tersebut" | Halaman itu khusus peran lain (mis. Super Admin). |

## 5. Meminta pemulihan akses

1. Hubungi Super Admin melalui kanal resmi sekolah (bukan pesan dari nomor tak dikenal).
2. Super Admin memeriksa akun di **Admin → Pengguna** dan mengaktifkan kembali atau
   menetapkan peran yang benar.
3. Bila Super Admin satu-satunya terkunci, petugas teknis dapat memulihkan peran lewat
   prosedur admin pertama di `docs/peran-dan-verifikasi.md`.

## 6. Panduan terkait

- Mengelola berita: `docs/PANDUAN_MENGELOLA_BERITA.md`
- Mengelola halaman, galeri, prestasi, kalender, pengumuman: `docs/PANDUAN_MENGELOLA_HALAMAN.md`
- Tahun ajaran, impor jadwal, arsip SK, perpustakaan: `docs/PANDUAN_ADMINISTRASI_SEKOLAH.md`
- Langganan berita email: `docs/langganan-berita-email.md`
- Peran & verifikasi: `docs/peran-dan-verifikasi.md`
- Database (petugas teknis): `docs/PANDUAN_DATABASE.md`
