# Panduan Mengelola Berita

Untuk admin dan editor sekolah. Tidak perlu coding, tidak perlu GitHub, dan tidak perlu
deploy ulang: berita yang diterbitkan langsung tampil di website.

## Siapa boleh apa

| Peran | Menulis draf | Kirim untuk persetujuan | Terbitkan / jadwalkan | Kembalikan ke penulis | Arsip & pulihkan | Hapus permanen |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|
| **Editor** | ✓ (berita sendiri) | ✓ | – | – | – | – |
| **Admin Website** | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| **Super Admin** (`admin`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

- Editor hanya melihat dan mengubah berita **miliknya** yang masih **Draf** atau
  **Menunggu persetujuan**. Berita yang sudah terbit diubah oleh Admin Website.
- Peran Editor/Admin Website diberikan Super Admin di **Admin → Pengguna** (bagian "CMS").
  Seorang guru bisa sekaligus menjadi Editor.

## Status berita

| Status | Arti | Tampil di website? |
|--------|------|:-:|
| Draf | Masih ditulis | Tidak |
| Menunggu persetujuan | Dikirim editor, menunggu Admin Website | Tidak |
| Terjadwal | Disetujui, tampil otomatis pada tanggal & jam yang ditentukan (WITA) | Mulai jadwal |
| Terbit | Tampil di halaman Berita dan beranda | **Ya** (bila Akses = Publik) |
| Arsip | Disembunyikan, masih tersimpan | Tidak |

Berita dengan Akses **Internal** hanya terlihat oleh guru/siswa yang sudah login dan
tidak pernah dikirim lewat buletin email.

## Menerbitkan berita, langkah demi langkah

1. Buka `https://<alamat-website>/masuk` dan masuk dengan akun Anda.
2. Klik **CMS Berita** di header (guru yang menjadi editor) atau buka `/admin` → **Berita**.
3. Klik **+ Tambah Berita**.
4. Isi **Judul berita**.
5. Tulis **Ringkasan** (1–2 kalimat). Ringkasan muncul di daftar berita dan email buletin.
6. Tulis **Isi berita** di editor:
   - **Judul / Subjudul** untuk membagi bagian artikel.
   - **B / I / U** untuk tebal, miring, garis bawah.
   - **• Daftar / 1. Daftar** untuk poin-poin.
   - **Tautan**: pilih teks, klik Tautan, isi alamat `https://…`.
   - **Gambar**: klik Gambar, pilih file, lalu isi deskripsi singkat gambar.
7. Unggah **Gambar utama** (JPG/PNG/WebP, maks. 5 MB). Pastikan foto boleh dipublikasikan
   dan tidak menampilkan data pribadi siswa.
8. Pilih **Kategori**, isi **Tag** bila perlu (pisahkan dengan koma).
9. Klik **Simpan**, lalu **Pratinjau ↗** untuk melihat tampilan seperti di website.
10. Editor: klik **Kirim untuk persetujuan**. Admin Website akan meninjau.
11. Admin Website: klik **Terbitkan / jadwalkan**. Kosongkan "Tanggal & jam terbit" untuk
    terbit sekarang, atau isi tanggal mendatang untuk menjadwalkan.
12. Buka halaman **Berita** di website dan pastikan berita sudah tampil.

## Meninjau berita (Admin Website)

1. Di **Ringkasan** admin, klik "N berita menunggu persetujuan Anda".
2. Buka berita, periksa isi dan **Pratinjau**.
3. Pilih:
   - **Terbitkan / jadwalkan**, atau
   - **Kembalikan ke penulis**: tulis catatan perbaikan. Editor melihat catatan itu di
     daftar berita dan di halaman berita.

## Mengedit, mengarsipkan, memulihkan

- **Mengedit berita terbit**: buka berita, ubah, klik **Simpan**. Perubahan langsung tampil.
- **Arsipkan**: berita hilang dari website tetapi tetap tersimpan.
- **Pulihkan sebagai draf**: membuka kembali berita arsip; terbitkan lagi bila perlu.
- **Riwayat perubahan**: setiap simpan tercatat (siapa dan kapan). **Pulihkan isi**
  mengembalikan judul, ringkasan, isi, gambar, dan kategori dari revisi tersebut.
- **Hapus permanen** hanya oleh Super Admin dan tidak dapat dibatalkan. Gunakan arsip
  bila ragu.

## Kategori

Admin Website mengelola kategori di **Berita → Kategori**. Kategori tampil sebagai
filter di halaman Berita publik. Menghapus kategori tidak menghapus beritanya.

## Jika ada masalah

| Masalah | Yang dilakukan |
|---------|----------------|
| Gambar gagal diunggah | Pastikan format JPG/PNG/WebP dan ukuran ≤ 5 MB. Kompres foto dari ponsel bila terlalu besar. Coba lagi bila koneksi terputus. |
| "Format gambar harus JPG, PNG, atau WebP" | File bukan gambar sungguhan (mis. HEIC dari iPhone). Ubah ke JPG terlebih dahulu. |
| Berita belum muncul di website | Periksa status: harus **Terbit** (bukan Terjadwal/Draf), Akses **Publik**, dan tanggal terbit sudah lewat. Muat ulang halaman. |
| Tombol Terbitkan tidak ada | Akun Anda berperan Editor. Kirim untuk persetujuan, atau minta peran Admin Website ke Super Admin. |
| "Slug sudah dipakai berita lain" | Ubah judul atau isi kolom Alamat (slug) dengan teks lain. |
| Tidak bisa mengubah berita | Editor tidak dapat mengubah berita orang lain atau yang sudah terbit. |

## Yang TIDAK perlu dilakukan

- Tidak perlu mengubah file kode (TSX/HTML/CSS/JSON).
- Tidak perlu commit ke GitHub atau deploy ulang.
- Tidak perlu membuka database Supabase.
