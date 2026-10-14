# Panduan Backup & Pemulihan

Untuk **petugas teknis**, dengan persetujuan Super Admin/kepala sekolah untuk setiap
pemulihan. Backup memuat **data pribadi** (akun, email pelanggan, NIP/NIS, SK internal),
jadi perlakukan file backup serahasia database itu sendiri.

> **Status pengujian (jujur):** skrip di panduan ini sudah diuji otomatis pada
> PostgreSQL lokal yang meniru struktur Supabase (`npm run test:backup`, juga di CI).
> Skrip **belum** diuji terhadap proyek Supabase sungguhan karena proyek produksi belum
> tersedia. Lakukan **uji pemulihan pertama** (bagian 6) segera setelah proyek dibuat,
> dan catat hasilnya di bagian 10. Sebelum itu, jangan menganggap backup sudah terjamin.

## 1. Apa yang perlu dibackup

| Bagian | Isi | Dibackup oleh |
|--------|-----|---------------|
| Database aplikasi | Semua tabel `public` (konten, akun, jadwal, SK, langganan, log) | Supabase (otomatis, tergantung paket) **dan** `scripts/backup-db.sh` |
| Akun login | `auth.users`, `auth.identities` (termasuk hash kata sandi & tautan Google) | `scripts/backup-db.sh` |
| Metadata file | `storage.objects` | `scripts/backup-db.sh` |
| **Isi file** (gambar, PDF SK) | Bucket `news-images`, `site-media`, `documents` | **Hanya** `scripts/backup-storage.mjs` |
| Konfigurasi di luar database | Environment hosting, pengaturan Auth Supabase, Google OAuth, Resend, DNS | Dicatat manual (bagian 8) |

## 2. Yang disediakan Supabase (periksa paket Anda)

Menurut dokumentasi resmi Supabase ([Database Backups](https://supabase.com/docs/guides/platform/backups)):
- Supabase membackup proyek setiap hari. Backup harian dapat diakses dari dasbor selama
  7 hari (Pro), 14 hari (Team), hingga 30 hari (Enterprise).
- Untuk proyek paket **Free**, Supabase menyarankan pengguna rutin mengekspor data
  sendiri dengan CLI dan menyimpan backup di luar Supabase.
- Point-in-Time Recovery (PITR) adalah add-on berbayar.
- **Backup database tidak menyertakan isi file Storage**, hanya metadata-nya. Memulihkan
  backup lama juga tidak mengembalikan file yang sudah dihapus.

Ketentuan ini dapat berubah. Periksa halaman dokumentasi dan paket proyek di
**Database → Backups** sebelum mengandalkannya, lalu catat di bagian 10.

**Kebijakan sekolah yang disarankan:** apa pun paketnya, jalankan backup mandiri
(database + Storage) **mingguan** dan sebelum setiap migrasi. Dengan begitu sekolah tetap
memegang salinan yang tidak bergantung pada akun Supabase.

## 3. Persiapan (sekali)

1. Komputer petugas dengan **bash** (Linux/macOS, atau Windows dengan WSL/Git Bash).
2. **PostgreSQL client tools** (`pg_dump`, `psql`) dengan versi mayor **sama atau lebih
   baru** dari server Supabase (lihat versi di `/admin/status`).
3. **OpenSSL** dan **Node.js 20+**. Clone repository, lalu jalankan `npm ci`.
4. **Connection string database:** Supabase → tombol **Connect** → *Session pooler* (atau
   *Direct connection*), pengguna `postgres`. Ini berbeda dengan URL API.
5. **Frasa sandi backup** (≥ 20 karakter acak) disimpan di **pengelola kata sandi
   sekolah**, terpisah dari lokasi file backup. Tanpa frasa ini backup tidak dapat dibuka.
6. Lokasi penyimpanan:
   - **Utama:** folder *Shared drive* Google sekolah khusus backup, akses hanya untuk
     petugas teknis & Super Admin.
   - **Kedua:** disk eksternal yang disimpan di lemari terkunci, atau penyimpanan cloud lain.

Simpan variabel sementara di terminal saja (jangan di file yang ikut ter-commit):

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<sandi-db>@<host-pooler>:5432/postgres'
export SUPABASE_URL='https://<ref>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<service-role-key>'
export BACKUP_PASSPHRASE='<frasa-sandi-backup>'
export PRODUCTION_PROJECT_REF='<ref>'   # mengaktifkan pengaman produksi pada skrip pulih
```

## 4. Membuat backup (mingguan & sebelum migrasi)

```bash
./scripts/backup-db.sh            # → backups/db-<waktu>.tar.gz.enc (+ .sha256)
node scripts/backup-storage.mjs   # → backups/storage-<waktu>.tar.gz.enc (+ .sha256)
```

- Jalankan keduanya berurutan agar data dan file sesuai waktu yang berdekatan.
- `backup-db.sh` mengambil seluruh data dalam **satu snapshot** dan menulis manifest
  (jumlah baris per tabel, versi, migrasi terakhir) beserta checksum.
- Peringatan pg_dump tentang *circular foreign-key constraints* adalah hal wajar.
- Unggah keempat file (`.enc` dan `.sha256`) ke kedua lokasi penyimpanan, lalu hapus
  salinan di laptop.
- Catat di buku log: tanggal, petugas, nama file, jumlah tabel/baris yang ditampilkan.

**Retensi:** simpan 8 backup mingguan terakhir, 12 backup bulanan (backup pertama tiap
bulan), dan backup akhir tahun ajaran sesuai kebijakan arsip sekolah. Hapus backup yang
melewati retensi dari kedua lokasi.

## 5. Isi dan keamanan file backup

- Dienkripsi AES-256 (OpenSSL, kunci diturunkan dari frasa sandi dengan PBKDF2 200.000
  iterasi). Skrip menolak membuat backup tanpa enkripsi.
- File `.sha256` mendeteksi file yang rusak atau berubah; di dalam arsip ada checksum
  tiap berkas.
- Jangan mengirim file backup lewat chat/email, dan jangan mengunggahnya ke layanan AI.

## 6. Uji pemulihan (wajib, minimal tiap semester)

Tujuannya membuktikan backup **benar-benar bisa dipulihkan**, tanpa menyentuh produksi.

1. Buat **proyek Supabase terpisah** bernama mis. `uji-pemulihan`, atau gunakan
   Supabase lokal (`npx supabase start`).
2. Terapkan struktur ke proyek uji:
   `npx supabase link --project-ref <ref-uji>` lalu `npx supabase db push`.
3. Pulihkan database:
   ```bash
   export RESTORE_DB_URL='postgresql://postgres.<ref-uji>:…@…:5432/postgres'
   ./scripts/restore-db.sh backups/db-<waktu>.tar.gz.enc
   ```
   Skrip memeriksa checksum, membuka enkripsi, mengganti isi tabel **di proyek uji**
   dalam satu transaksi, lalu memverifikasi jumlah baris setiap tabel.
4. Pulihkan file:
   ```bash
   export RESTORE_SUPABASE_URL='https://<ref-uji>.supabase.co'
   export RESTORE_SUPABASE_SERVICE_ROLE_KEY='<service-role proyek uji>'
   node scripts/restore-storage.mjs backups/storage-<waktu>.tar.gz.enc
   ```
5. Jalankan aplikasi lokal yang terhubung ke proyek uji (`.env.local` berisi kunci proyek
   uji), lalu periksa:
   - `npm run smoke -- http://localhost:3000` lulus;
   - masuk sebagai admin, lalu `/admin/status` tidak menampilkan peringatan database;
   - buka beberapa berita, satu album galeri, dan **unduh satu SK**.
6. Catat hasil di bagian 10. Setelah selesai, **hapus proyek uji** (berisi data pribadi).

## 7. Pemulihan darurat ke produksi

Hanya bila data produksi rusak/hilang, dan **hanya dengan persetujuan tertulis kepala
sekolah**. Jangan pernah memulihkan ke produksi untuk "mencoba".

1. **Hentikan perubahan:** umumkan ke admin agar tidak mengedit; bila perlu matikan
   sementara aplikasi di hosting.
2. **Backup kondisi saat ini** terlebih dahulu (bagian 4), walaupun rusak, sebagai bukti.
3. Pilih sumber:
   - **Kerusakan database saja, paket Pro ke atas:** gunakan pemulihan bawaan di
     **Database → Backups** (atau PITR bila aktif). Ini hanya memulihkan database.
   - **Paket Free, atau backup mandiri lebih baik:** gunakan skrip.
4. Database dengan skrip (pengaman produksi akan meminta konfirmasi ketik ulang):
   ```bash
   export RESTORE_DB_URL="$SUPABASE_DB_URL"
   ./scripts/restore-db.sh backups/db-<waktu>.tar.gz.enc --produksi
   ```
5. File Storage: `restore-storage.mjs` dengan `--produksi`. Skrip ini hanya mengunggah
   file yang **hilang** dan tidak menimpa file yang ada.
6. Verifikasi: `npm run smoke -- https://<domain>`, `/admin/status`, dan pemeriksaan
   manual konten penting.
7. Laporkan ke admin: data setelah waktu backup **hilang** dan perlu dimasukkan ulang.
   Pengguna perlu masuk ulang.
8. Catat insiden di buku log (lihat `PANDUAN_OPERASIONAL_ADMIN.md` §6).

Bila memulihkan ke **proyek Supabase baru** sebagai pengganti produksi, perbarui juga:
environment hosting (URL & kunci), *Site URL* dan *Redirect URLs* di Supabase Auth,
redirect URI di Google Cloud, URL webhook Resend, lalu jalankan smoke test.

## 8. Konfigurasi di luar database (catat & simpan di pengelola sandi)

Tidak ada di backup mana pun, jadi catat saat berubah:
- Environment hosting (daftar variabel `.env.example`, berikut nilainya di pengelola sandi).
- **`RASA_ENCRYPTION_KEY`**: isi laporan Ruang Rasa di backup berupa teks sandi dan **tidak dapat dibaca tanpa kunci ini**. Simpan di pengelola sandi, terpisah dari file backup. Setelah pemulihan ke proyek lain, kunci yang sama harus dipasang.
- Supabase **Authentication**: provider Google (Client ID; secret di pengelola sandi),
  Site URL, Redirect URLs, template email, pengaturan kata sandi & rate limit.
- Google Cloud: OAuth consent screen, redirect URI.
- Resend: domain & DNS (SPF/DKIM), API key, webhook.
- DNS domain sekolah dan pengaturan hosting.

## 9. Pemecahan masalah

| Pesan | Penyebab / solusi |
|-------|-------------------|
| `server version mismatch` / `aborting because of server version mismatch` | Perbarui PostgreSQL client tools ke versi mayor server |
| `BACKUP_PASSPHRASE belum diisi` | Isi frasa sandi; backup tanpa enkripsi ditolak |
| `DITOLAK: tujuan pemulihan adalah database PRODUKSI` | Pengaman bekerja. Gunakan proyek uji, atau prosedur bagian 7 |
| `Checksum … TIDAK cocok` | File rusak/berubah; ambil salinan dari lokasi penyimpanan kedua |
| `Gagal membuka backup` | Frasa sandi salah atau file rusak |
| `Database tujuan belum berisi struktur` | Jalankan `supabase db push` ke proyek tujuan dulu |
| `Verifikasi GAGAL` | Jangan gunakan hasil pemulihan; simpan keluaran terminal dan hubungi pengembang |
| `permission denied` saat pulih | Gunakan koneksi pengguna `postgres` (bukan pengguna lain). Bila tetap ditolak pada tabel `auth.*` atau `storage.objects`, hak pengguna `postgres` di Supabase mungkin sudah berubah: catat pesan lengkapnya dan hubungi pengembang. Hal ini termasuk yang harus dipastikan pada uji pemulihan pertama |
| `column … does not exist` pada `auth.users` | Versi Supabase Auth proyek tujuan lebih lama dari sumber; gunakan proyek tujuan yang baru/terbarui |

## 10. Catatan pelaksanaan (diisi sekolah)

| Item | Isi |
|------|-----|
| Paket Supabase & fitur backup bawaan (dicek tanggal) | _(isi)_ |
| Lokasi penyimpanan utama / kedua | _(isi, tanpa kata sandi)_ |
| Pemegang frasa sandi backup | _(isi jabatan)_ |
| **Uji pemulihan pertama terhadap Supabase sungguhan** | Tanggal: ___ · Petugas: ___ · Hasil: ___ |
| Uji pemulihan berikutnya | _(tanggal & hasil)_ |
