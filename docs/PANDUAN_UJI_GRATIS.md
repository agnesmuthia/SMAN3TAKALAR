# Panduan Uji Coba Gratis

Cara mencoba seluruh fitur website **tanpa biaya dan tanpa hosting**, memakai proyek
Supabase gratis dan menjalankan situs di GitHub Codespaces atau komputer sendiri.
Untuk pemasangan sungguhan (produksi), ikuti `PANDUAN_DEPLOYMENT_HOSTINGER.md`.

> **Catatan jujur:** langkah di bawah disusun dari konfigurasi proyek dan sudah
> sejalan dengan pengujian otomatis, tetapi **belum dijalankan ulang di Codespaces
> sungguhan**. Bila ada langkah yang berbeda di layar Anda (Supabase atau GitHub kadang
> mengubah tampilan), ikuti petunjuk di layar dan catat bagian yang perlu diperbaiki.

## 0. Mengapa tidak GitHub Pages?

GitHub Pages hanya menyajikan situs statis. Website ini butuh server Node.js (login,
dashboard, penyimpanan data), jadi tidak dapat berjalan di sana. GitHub dipakai untuk
**menyimpan kode** dan **Codespaces** (komputer virtual di browser) untuk menjalankannya.

## 1. Yang dibutuhkan

| Kebutuhan | Biaya | Keterangan |
|-----------|-------|------------|
| Akun GitHub dengan akses ke repository | Gratis | Codespaces punya kuota gratis bulanan untuk akun pribadi |
| Akun Supabase (paket Free) | Gratis | 500 MB database, 1 GB file; proyek dijeda otomatis bila seminggu tanpa aktivitas |
| Browser | - | Tidak perlu memasang apa pun di komputer bila memakai Codespaces |

**Gunakan data fiktif saja.** Jangan memasukkan data siswa, guru, atau laporan Ruang Rasa
yang asli ke proyek uji.

## 2. Buat proyek Supabase uji

1. Masuk ke supabase.com → **New project** (paket Free). Beri nama, mis. `smatrik-uji`.
2. **Catat password database** yang Anda buat (dibutuhkan di langkah 4).
3. Buka **Project Settings → API** dan salin tiga nilai:
   - **Project URL**
   - **anon / publishable key** (aman dipakai di browser)
   - **service_role key**: **RAHASIA**. Jangan dikirim lewat chat/email dan jangan
     disimpan di repository.
4. Buka **Authentication → Providers → Email** dan matikan **Confirm email** selama uji.
   Email bawaan Supabase sangat dibatasi sehingga pendaftaran uji bisa macet bila
   konfirmasi tetap aktif. **Aktifkan lagi sebelum produksi.**
5. Buka **Authentication → URL Configuration**, isi **Site URL** dengan alamat situs uji
   (lihat langkah 3) dan tambahkan ke **Redirect URLs**:
   `<alamat-situs>/auth/callback` dan `<alamat-situs>/auth/confirm`.
   Alamat Codespaces baru diketahui setelah langkah 5, jadi bagian ini boleh diisi
   kemudian.

## 3. Buka Codespaces

1. Di GitHub, buka repository → tombol hijau **Code** → tab **Codespaces** →
   **Create codespace on `<branch>`**.
2. Pilih branch `main` (atau `claude/optimistic-keller-497q7v` bila PR belum digabung).
3. Tunggu editor terbuka di browser, lalu buka **Terminal** (menu Terminal → New Terminal).
4. Periksa versi Node: `node -v`. Harus **20.9 atau lebih baru** (disarankan 22; lihat
   `.nvmrc`).

Alternatif: jalankan di komputer sendiri (Node.js 20.9+ dan Git terpasang), lalu
`git clone` repository dan buka terminalnya di folder proyek.

## 4. Pasang dan terapkan database

```bash
npm ci
cp .env.example .env.local
npx supabase login                       # membuka tautan masuk di browser
npx supabase link --project-ref <ref>    # ref = bagian depan Project URL (…<ref>.supabase.co)
npx supabase db push                     # menerapkan 11 migrasi; minta password database
```

`db push` hanya **menambah** struktur ke proyek uji yang masih kosong. Jangan menjalankan
perintah ini ke proyek produksi tanpa membaca `PANDUAN_DATABASE.md` §8.

Jangan menjalankan `supabase/seed.sql` kecuali Anda memang ingin data contoh fiktif di
proyek uji ini (jangan pernah di produksi).

## 5. Isi `.env.local`

Buka berkas `.env.local` dan isi (nilai lain biarkan seperti bawaan):

| Variabel | Isi |
|----------|-----|
| `NEXT_PUBLIC_SITE_URL` | Lokal: `http://localhost:3000`. Codespaces: alamat port 3000 dari tab **Ports** (mis. `https://…-3000.app.github.dev`), tanpa `/` di akhir |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari langkah 2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `NEWSLETTER_TOKEN_SECRET` | hasil `openssl rand -base64 48` |
| `RASA_ENCRYPTION_KEY` | hasil `openssl rand -base64 32` (untuk menguji Ruang Rasa) |
| `EMAIL_PROVIDER` | `console` (**hanya untuk uji**): isi email tampil di terminal, tidak dikirim |

Pada Codespaces, alamat sudah berubah-ubah per codespace; bila alamat berganti, perbarui
`NEXT_PUBLIC_SITE_URL` dan Redirect URLs di Supabase, lalu jalankan ulang `npm run dev`.

## 6. Jalankan situs

```bash
npm run dev
```

- Lokal: buka `http://localhost:3000`.
- Codespaces: buka tab **Ports**, cari port 3000, klik ikon globe (Open in Browser).
  Bila port berstatus Private, buka dengan akun GitHub Anda sendiri.

## 7. Jadikan akun Anda Super Admin

1. Buka **/daftar** dan daftar dengan email Anda.
2. Di Supabase → **SQL Editor**, jalankan (ganti email):
   ```sql
   update public.profiles
      set role = 'admin', status = 'active', verified_at = now()
    where id = (select id from auth.users where email = 'email-anda@contoh.com');
   ```
3. Keluar lalu masuk lagi di **/masuk**. Menu **/admin** kini terbuka.

Hanya dengan langkah ini peran admin diberikan. Login (termasuk Google) tidak pernah
memberi peran otomatis.

## 8. Fitur yang dicoba

| Fitur | Cara mencoba | Yang diharapkan |
|-------|--------------|-----------------|
| Profil sekolah | `/admin/profil-sekolah`: isi nama, kontak | Tampil di beranda/footer |
| Berita | `/admin/berita` → tulis, unggah gambar, kirim review → terbitkan | Muncul di `/berita`; draf tidak tampil publik |
| Halaman, program, galeri, prestasi, kalender | Menu di `/admin` | Tampil di halaman publik; bagian kosong disembunyikan |
| Guru dan siswa | Daftar dengan akun lain (jendela penyamaran), ajukan verifikasi, setujui di `/admin/verifikasi` | Dashboard guru/siswa terbuka setelah disetujui, bukan sebelumnya |
| Jadwal | `/admin/tahun-ajaran` lalu `/admin/jadwal` (impor CSV/XLSX) | Pratinjau dulu, lalu jadwal tampil di dashboard guru/siswa |
| Arsip SK, perpustakaan | `/admin/arsip-sk`, `/admin/perpustakaan` | SK publik dapat diunduh; internal hanya untuk akun aktif |
| Langganan berita | Daftar email di beranda | Tautan konfirmasi tercetak di **terminal** (karena `console`) |
| Ruang Rasa | Lihat bagian 9 | Laporan anonim terkirim dan terbaca hanya oleh Guru BK |
| Status sistem | `/admin/status` | Daftar konfigurasi yang masih kurang |
| Log aktivitas | `/admin/log` | Aksi admin tercatat |

Pemeriksaan otomatis terhadap situs yang sedang berjalan (di terminal kedua):

```bash
npm run smoke -- http://localhost:3000
```

## 9. Menguji Ruang Rasa

1. Buat akun kedua, ajukan sebagai guru, lalu di **/admin/pengguna** beri peran
   **Guru BK** dan status aktif.
2. Di **/admin/ruang-rasa**, **Tugaskan** akun itu, isi catatan prosedur darurat
   (fiktif untuk uji).
3. Di jendela penyamaran (tanpa login) buka **/ruang-rasa**, kirim laporan uji. Catat
   **kode** dan **PIN** yang tampil (hanya sekali).
4. Masuk sebagai Guru BK → **Dashboard → Ruang Rasa**: laporan terbaca; balas dan ubah
   status.
5. Di jendela penyamaran buka **/ruang-rasa/cek**, masukkan kode + PIN: balasan terlihat.
   Coba PIN salah: pesan sama dengan kode yang tak dikenal.
6. Masuk sebagai **Super Admin**: di `/admin/ruang-rasa` hanya terlihat jumlah dan catatan
   akses, **tidak** ada isi laporan.
7. Di Supabase **Table Editor** → `rasa_reports`: kolom isi berupa teks sandi.
8. Setelah status **Selesai**, pelapor tidak dapat mengirim pesan lagi.

Hapus data uji setelah selesai (Authentication → Users, dan baris di tabel terkait lewat
SQL Editor pada proyek **uji** itu saja), atau hapus saja proyek ujinya.

## 10. Yang belum dapat diuji dengan cara ini

| Bagian | Alasan | Cara berikutnya |
|--------|--------|-----------------|
| Email sungguhan (konfirmasi akun, buletin, notifikasi Ruang Rasa) | Resend butuh domain yang diverifikasi | Ikuti `langganan-berita-email.md` setelah punya domain |
| Login Google | Perlu OAuth di Google Cloud | `google-oauth.md` |
| Backup/pemulihan di Supabase sungguhan | Perlu `SUPABASE_DB_URL` | `PANDUAN_BACKUP_PEMULIHAN.md` §6, **di proyek uji dulu** |
| Penjadwal cron (pengiriman terjadwal, penghapusan otomatis Ruang Rasa) | Butuh alamat publik dan `CRON_SECRET` | `PANDUAN_DEPLOYMENT_HOSTINGER.md` §7 |
| Kinerja dan keamanan di domain/HTTPS sungguhan | Hanya ada di hosting | Checklist go-live di panduan deployment |

## 11. Opsional: alamat publik gratis untuk uji (Vercel)

Bila ingin membagikan alamat uji ke beberapa orang, Vercel (paket Hobby) dapat
menjalankan aplikasi Next.js. Catatan:

- Paket Hobby ditujukan untuk **penggunaan pribadi non-komersial**. Periksa ketentuannya
  untuk sekolah; pakai hanya untuk uji, **bukan produksi**.
- Isi environment variables yang sama dengan `.env.local` di pengaturan proyek Vercel,
  kecuali `EMAIL_PROVIDER=console` (ditolak aplikasi di produksi; biarkan kosong).
- Tambahkan alamat Vercel ke Site URL dan Redirect URLs di Supabase.
- `vercel.json` memuat satu cron harian (cek batas paket Hobby saat ini).

Langkah ini belum diuji.

## 12. Pemecahan masalah

| Gejala | Penyebab / tindakan |
|--------|----------------------|
| Halaman error "Invalid API key" atau data tidak muncul | URL/anon key di `.env.local` salah; jalankan ulang `npm run dev` setelah mengubahnya |
| Pendaftaran tidak pernah selesai | "Confirm email" masih aktif di Supabase dan email tidak terkirim; matikan selama uji |
| Setelah masuk kembali ke halaman masuk | Site URL/Redirect URLs di Supabase belum cocok dengan alamat yang Anda buka |
| `/admin` menolak akses | Perintah SQL di langkah 7 belum dijalankan untuk email yang benar; keluar dan masuk lagi |
| Unggah gambar gagal | Migrasi belum diterapkan (bucket belum ada) atau `SUPABASE_SERVICE_ROLE_KEY` salah |
| Ruang Rasa menampilkan "sedang disiapkan" | `RASA_ENCRYPTION_KEY` kosong/tidak valid (harus base64 dari 32 byte) |
| Aksi/tombol gagal hanya di Codespaces | Kemungkinan terkait alamat port yang diteruskan; pastikan `NEXT_PUBLIC_SITE_URL` sama persis dengan alamat di address bar. Bila tetap gagal, jalankan di komputer sendiri dan laporkan pesan error-nya |
| Proyek Supabase "paused" | Hidupkan lagi dari dashboard Supabase (Restore project) |
