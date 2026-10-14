# Panduan Mengelola Konten Situs

Untuk **Admin Website** dan **Super Admin**. Editor hanya dapat mengelola berita.
Semua menu di bawah ada di dashboard admin (`/admin`). Tidak perlu coding.

> Prinsip: isi hanya dengan **informasi resmi dan benar**. Bagian beranda yang belum
> berisi data otomatis disembunyikan, jadi tidak perlu mengisi data contoh.

## 1. Profil Sekolah (`/admin/profil-sekolah`)

Mengatur bagian yang tampil di seluruh website:

| Isian | Tampil di |
|-------|-----------|
| Judul & subjudul hero, gambar hero | Bagian atas beranda |
| Logo | Header, footer (kosong = monogram netral, bukan logo resmi) |
| Alamat, telepon, email, WhatsApp, tautan Google Maps | Footer, halaman Profil |
| Instagram, Facebook, YouTube, TikTok | Footer (hanya yang diisi) |

- Tautan wajib diawali `https://`. Nomor WhatsApp hanya angka (boleh diawali `+`).
- Logo/gambar: JPG, PNG, atau WebP, maks. 5 MB. Pastikan sekolah berhak memakainya.

## 2. Halaman (`/admin/halaman`)

Untuk Profil, Visi dan Misi, Sejarah, Struktur Organisasi, Kontak, dan sejenisnya.

1. **+ Halaman baru** → isi judul, ringkasan, dan isi (editor teks sama seperti berita).
2. **Urutan** menentukan posisi di menu Profil (angka kecil tampil lebih dulu).
3. Centang **Tampilkan di website** bila sudah siap. Tanpa centang = draf.
4. Alamat halaman: `/profil/<slug>`. Slug dibuat otomatis dari judul bila dikosongkan.

Menghapus halaman memerlukan centang "Saya yakin". Untuk menyembunyikan sementara,
cukup hapus centang **Tampilkan di website**.

## 3. Program Unggulan (`/admin/program`)

Kartu program di beranda dan halaman Profil. Isi nama, deskripsi singkat, gambar
(opsional), dan halaman detail (opsional, dipilih dari daftar Halaman).

## 4. Galeri (`/admin/galeri`)

1. Buat album: judul, tanggal kegiatan, deskripsi.
2. Unggah foto di halaman album (boleh memilih banyak foto sekaligus, maks. 50 per kali;
   setiap foto maks. 5 MB). Foto diproses satu per satu.
3. Isi keterangan foto, atur urutan, dan pilih **Jadikan sampul**.
4. Untuk menerbitkan album, centang **konfirmasi izin publikasi**. Database menolak
   album terbit tanpa konfirmasi ini.

> **Izin foto siswa.** Hanya unggah foto yang sudah dipastikan boleh dipublikasikan
> (kebijakan sekolah/persetujuan orang tua). Hindari foto close-up siswa tanpa izin,
> foto yang memperlihatkan data pribadi (papan nama, rapor), atau foto yang memalukan.

## 5. Prestasi (`/admin/prestasi`)

Isi nama prestasi, tingkat, tanggal, penyelenggara, keterangan, foto, dan berita terkait
(opsional). **Penerima**: nama siswa tampil publik; isi hanya bila sudah diizinkan. Bila
ragu, tulis nama tim atau kelas. Pengunjung dapat menyaring prestasi per tingkat & tahun.

## 6. Kalender Kegiatan (`/admin/kalender`)

- Isi nama, kategori (Akademik, Ujian, Libur, Kegiatan, Rapat, Lainnya), tanggal mulai,
  tanggal selesai (kosong = satu hari), jam (opsional, WITA), dan tempat.
- **Ditampilkan untuk**: *Publik* (semua pengunjung) atau *Internal* (hanya guru & siswa
  yang sudah diverifikasi dan login). Kegiatan internal tidak terlihat oleh pengunjung.
- Daftar admin menampilkan kegiatan mendatang; klik **Lihat kegiatan lampau** untuk arsip.

## 7. Pengumuman (`/admin/pengumuman`)

Admin Website kini dapat mengelola pengumuman. Pilih audiens:

| Audiens | Terlihat oleh |
|---------|---------------|
| Publik | Semua pengunjung website (`/pengumuman` dan beranda) |
| Semua | Semua warga sekolah yang login & terverifikasi |
| Guru / Siswa / Guru BK | Peran tersebut saja |

Jangan memuat data pribadi siswa, nilai, atau data konseling di pengumuman apa pun.
Pengumuman tidak pernah dikirim lewat buletin email.

## 8. Pemecahan masalah

| Gejala | Penyebab & solusi |
|--------|-------------------|
| "Akses ditolak" | Akun bukan Admin Website/Super Admin. Minta ke Super Admin. |
| "URL harus diawali https://" | Salin tautan lengkap dari peramban. |
| "Alamat (slug) sudah dipakai" | Ubah judul atau isi slug lain. |
| Unggahan gagal / "Ukuran gambar" | Perkecil gambar (< 5 MB) dan gunakan JPG/PNG/WebP. |
| Album tidak bisa diterbitkan | Centang konfirmasi izin publikasi foto. |
| Perubahan belum terlihat | Muat ulang halaman; pastikan dicentang "Tampilkan". |
