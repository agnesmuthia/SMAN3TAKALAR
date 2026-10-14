# Panduan Administrasi Sekolah

Untuk **Petugas Administrasi** dan **Super Admin**. Perpustakaan juga dapat dikelola
**Admin Website**. Semua menu ada di dashboard admin (`/admin`), kelompok **Administrasi**.

## 1. Mendapatkan akses

Super Admin membuka **Pengguna**, lalu pada akun guru/staf yang sudah aktif centang
**Petugas Administrasi** dan klik **Simpan peran staf**. Peran ini tidak dapat diberikan
kepada akun siswa, karena petugas dapat melihat arsip SK internal.

## 2. Tahun ajaran & semester (`/admin/tahun-ajaran`)

1. **Tambah tahun ajaran**: tulis seperti `2026/2027`, isi tanggal mulai & selesai.
2. **Tambah semester** Ganjil dan Genap. Tanggalnya harus di dalam rentang tahun ajaran.
3. Klik **Jadikan aktif** pada semester yang sedang berjalan. Hanya satu semester yang
   aktif; tahun ajarannya ikut aktif.

Akibatnya: siswa dan guru hanya melihat jadwal **semester aktif** (plus jadwal lama yang
dibuat sebelum fitur semester ada). Jadwal semester lain tetap tersimpan.

Semester yang masih punya jadwal **tidak dapat dihapus** (jadwal tidak pernah dihapus
otomatis). Hapus jadwalnya dulu, atau biarkan semester tetap ada sebagai arsip.

## 3. Jadwal pelajaran (`/admin/jadwal`)

- Pilih semester di bagian atas, lalu tambah sesi satu per satu, atau impor dari file.
- Sistem menolak sesi yang **bentrok**: kelas yang sama pada jam yang tumpang tindih,
  atau guru yang sama mengajar dua kelas pada jam yang sama.
- Kolom **Sumber** menunjukkan apakah sesi dibuat manual atau dari impor tertentu.

## 4. Impor jadwal dari CSV/XLSX (`/admin/jadwal/impor`)

### Menyiapkan file
Unduh templat kosong (XLSX atau CSV) di halaman impor. Kolom:

| Kolom | Wajib | Contoh / aturan |
|-------|-------|-----------------|
| Kelas | Ya | Sama persis dengan kelas siswa di sistem, mis. `X-1` |
| Hari | Ya | Senin–Sabtu (atau angka 1–6) |
| Jam Mulai | Ya | `07:30` atau `7.30` (WITA) |
| Jam Selesai | Ya | Harus setelah jam mulai |
| Mata Pelajaran | Ya | Maks. 100 karakter |
| Guru | Tidak | Nama lengkap **persis** seperti di akun guru yang sudah diverifikasi |
| Ruang | Tidak | Maks. 40 karakter |

- XLSX: hanya **sheet pertama** yang dibaca. File `.xls` lama harus disimpan ulang sebagai `.xlsx`.
- CSV: pemisah koma atau titik koma, encoding UTF-8.
- Batas: 2 MB dan 2.000 baris per file.

### Langkah impor
1. Pilih **semester tujuan** dan file, lalu klik **Periksa file**.
2. Sistem menampilkan **pratinjau** dan laporan per baris. Pada tahap ini **belum ada
   jadwal yang berubah**.

   | Status | Arti |
   |--------|------|
   | Siap diimpor | Baris valid dan akan dimasukkan |
   | Sudah ada (dilewati) | Kelas itu sudah punya sesi yang mulai di jam yang sama; **tidak ditimpa** |
   | Bermasalah | Ada kesalahan (hari/jam salah, guru tidak ditemukan, duplikat di file, bentrok); baris tidak diimpor |

3. Klik **Impor N baris** untuk memasukkan baris yang siap, atau **Buang pratinjau**.
   Bila jadwal berubah sejak pratinjau dibuat, sistem meminta Anda mengunggah ulang.
4. Perbaiki baris bermasalah di file, lalu unggah ulang. Baris yang sudah masuk akan
   otomatis berstatus "Sudah ada", jadi aman diunggah ulang.

### Membatalkan impor
Buka impor di **Riwayat impor**, lalu klik **Batalkan impor ini** dan centang konfirmasi.
Yang dihapus **hanya sesi yang berasal dari file itu**; jadwal lain tidak berubah.

## 5. Arsip SK (`/admin/arsip-sk`)

1. Isi nomor SK, perihal, tanggal ditetapkan, (opsional) penetap dan tahun ajaran.
2. Unggah **PDF** (maks. 10 MB). File disimpan di penyimpanan **privat**.
3. Pilih **status** (Masih berlaku / Arsip) dan **dapat dilihat oleh**:
   - **Internal**: hanya guru & siswa yang sudah diverifikasi dan masuk.
   - **Publik**: semua pengunjung di halaman `/dokumen`.
4. Centang **konfirmasi pemeriksaan** setelah memastikan isi PDF sesuai metadata dan boleh
   dibagikan. Tanpa konfirmasi ini SK **tidak dapat ditampilkan** (dijaga database).
5. Centang **Tampilkan di halaman Arsip SK**.

Catatan penting:
- SK yang memuat data pribadi (NIK, alamat, nilai, data kesehatan) **jangan publik**.
- Mengganti file PDF mencatat ulang waktu pemeriksaan; periksa lagi isinya.
- SK yang tidak berlaku sebaiknya diubah statusnya menjadi **Arsip**, bukan dihapus.
  Menghapus SK juga menghapus file PDF-nya secara permanen.
- Pengunduh mendapat tautan sementara (60 detik) setelah sistem memastikan haknya.
- PDF yang berisi skrip/aksi otomatis ditolak. Simpan ulang lewat "Cetak → Simpan sebagai PDF".
  Pemeriksaan ini bukan antivirus; unggah hanya file dari sumber resmi sekolah.

## 6. Perpustakaan digital (`/admin/perpustakaan`)

- **Tautan** (disarankan): ke sumber resmi seperti Portal Buku Kemendikdasmen atau situs
  penerbit resmi. Wajib `https://`.
- **PDF**: hanya karya milik sekolah (modul guru, buletin) atau yang sudah berizin. Centang
  konfirmasi hak distribusi; tanpa itu PDF tidak dapat ditampilkan.
  **Jangan mengunggah salinan buku berhak cipta tanpa izin.**
- Kategori bebas (mis. Buku Teks, Modul, Referensi). Koleksi dapat **Publik** atau **Internal**.
- Halaman publik `/perpustakaan` selalu menampilkan tautan Portal Buku Kemendikdasmen.

## 7. Pemecahan masalah

| Gejala | Penyelesaian |
|--------|--------------|
| Menu Administrasi tidak muncul | Minta Super Admin memberi peran Petugas Administrasi |
| "Kolom wajib tidak ditemukan" | Baris pertama file harus judul kolom seperti templat |
| "Guru … tidak ditemukan" | Samakan penulisan nama dengan akun guru, atau kosongkan lalu tetapkan manual |
| "Ada 2 guru bernama …" | Kosongkan kolom guru untuk baris itu, tetapkan guru secara manual setelah impor |
| "Format file harus .csv atau .xlsx" | Simpan ulang file dari Excel/Google Sheets sebagai .xlsx |
| "Jadwal berubah sejak pratinjau dibuat" | Buang pratinjau, unggah ulang file |
| Semester tidak bisa dihapus | Semester masih punya jadwal; ini perlindungan data |
| SK tidak bisa ditampilkan | Centang konfirmasi pemeriksaan |
