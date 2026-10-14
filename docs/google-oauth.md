# Konfigurasi Login & Pendaftaran dengan Google

Login Google memakai **Supabase Auth** (OAuth 2.0 + PKCE). Aplikasi tidak membuat
implementasi OAuth sendiri dan **tidak pernah** menyimpan Client Secret Google di
kode, repository, atau browser. Secret hanya diisi di dasbor Supabase.

> **Status:** kode sudah siap, tetapi login Google **belum aktif** sampai langkah di
> bawah dikerjakan dengan kredensial asli dan diuji. Jangan menganggapnya berfungsi
> sebelum daftar uji di bagian akhir dokumen ini lulus.

## Gambaran alur

```
Pengguna klik "Lanjutkan dengan Google"
  → Supabase Auth → halaman persetujuan Google
  → Google mengembalikan ke https://<project-ref>.supabase.co/auth/v1/callback
  → Supabase mengembalikan ke https://<situs>/auth/callback?code=...&next=...
  → Server menukar code menjadi sesi, memvalidasi ulang pengguna (getUser)
  → Memeriksa profil di database:
       akun baru / pending  → /akun/lengkapi-profil atau /akun/menunggu
       nonaktif             → keluar + pesan "akun dinonaktifkan"
       aktif                → dashboard sesuai peran
```

Login Google **hanya membuktikan identitas akun Google**. Peran guru/siswa tetap
harus diverifikasi admin (lihat `docs/peran-dan-verifikasi.md`).

## 1. Membuat OAuth Client di Google Cloud Console

1. Buka <https://console.cloud.google.com/> dan buat/pilih project (mis. "Website SMAN 3 Takalar").
2. Buka **Google Auth Platform** → **Branding**: isi nama aplikasi, email dukungan,
   logo (opsional, hanya bila diizinkan sekolah), tautan kebijakan privasi
   (`https://<domain>/kebijakan-privasi`), dan domain resmi.
3. **Audience**:
   - Pilih **External** bila pengguna memakai Gmail pribadi.
   - Pilih **Internal** hanya bila sekolah memakai Google Workspace dan semua pengguna
     berada di domain tersebut.
   - Setelah diuji, klik **Publish app** agar tidak terbatas pada test users.
4. **Data Access (scopes)**: cukup `openid`, `.../auth/userinfo.email`,
   `.../auth/userinfo.profile`. Jangan menambah scope lain.
5. **Clients** → **Create client** → *Web application*:
   - **Authorized JavaScript origins**
     - `http://localhost:3000` (pengembangan)
     - `https://<domain-produksi>` (mis. `https://sman3takalar.sch.id`)
   - **Authorized redirect URIs** (milik Supabase, bukan milik situs):
     - `https://<project-ref>.supabase.co/auth/v1/callback`
6. Salin **Client ID** dan **Client Secret**. Simpan di pengelola kata sandi sekolah;
   jangan dikirim lewat chat/email terbuka dan jangan di-commit.

## 2. Mengaktifkan provider Google di Supabase

1. Dasbor Supabase → **Authentication** → **Sign In / Providers** → **Google**.
2. Aktifkan, tempel Client ID dan Client Secret, lalu simpan.
3. **Authentication** → **URL Configuration**:
   - **Site URL**: `https://<domain-produksi>`
   - **Redirect URLs** (allowlist):
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/confirm`
     - `https://<domain-produksi>/auth/callback`
     - `https://<domain-produksi>/auth/confirm`
   Supabase menolak `redirectTo` di luar daftar ini.

## 3. Template email Supabase (pendaftaran email & reset kata sandi)

Aplikasi memverifikasi tautan email lewat `/auth/confirm?token_hash=...`. Ubah
template di **Authentication** → **Email Templates**:

- **Confirm signup**:
  `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Konfirmasi email</a>`
- **Reset password**:
  `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Atur ulang kata sandi</a>`

Untuk produksi, atur **SMTP kustom** (mis. Resend, lihat `docs/langganan-berita-email.md`)
karena SMTP bawaan Supabase sangat terbatas.

## 4. Penautan akun Google dengan akun yang sudah ada

- **Penautan otomatis Supabase:** menurut dokumentasi Supabase, identitas dengan email
  yang sama akan ditautkan ke satu pengguna hanya bila email tersebut **sudah
  terverifikasi**. Email yang belum dikonfirmasi tidak ditautkan otomatis. Periksa
  ulang perilaku ini di dokumentasi versi Supabase yang dipakai sebelum produksi.
- **Penautan manual (disarankan bila otomatis dimatikan):** aktifkan
  **Authentication → Sign In / Providers → Allow manual linking**. Pengguna masuk
  dengan metode lamanya terlebih dahulu (membuktikan kepemilikan), lalu klik
  **Tautkan akun Google** di halaman `/akun`.
- Aplikasi **tidak pernah** menggabungkan akun berdasarkan nama.
- **Konflik akun** (mis. Google sudah tertaut ke akun lain): pengguna melihat pesan
  "Akun Google gagal ditautkan". Prosedur penyelesaian: pengguna menghubungi admin;
  admin memverifikasi identitas secara langsung (tatap muka/kanal resmi sekolah),
  lalu menonaktifkan akun duplikat di `/admin/pengguna`. Bila perlu, hapus pengguna
  duplikat di dasbor Supabase (**Authentication → Users**) setelah memastikan tidak ada
  data yang perlu dipindahkan.

## 5. Data yang dikirim/diterima

- Diterima dari Google: email, ID akun, nama & foto profil (disimpan Supabase di
  `auth.users`). **Nama Google tidak disalin** ke profil sekolah.
- Tidak pernah dikirim ke Google/metadata OAuth: NIP, NIS, peran, data konseling.
  NIP/NIS disimpan di tabel `verification_requests` (RLS: pemilik & admin).
- Tidak ada Google Analytics atau pelacak pihak ketiga.

## 6. Daftar uji (wajib setelah kredensial asli dipasang)

| # | Skenario | Hasil yang diharapkan |
|---|----------|-----------------------|
| 1 | Klik "Lanjutkan dengan Google" di `/masuk`, pilih akun | Kembali ke situs; akun baru diarahkan ke `/akun/lengkapi-profil` |
| 2 | Batalkan di layar Google | Kembali ke `/masuk` dengan pesan "dibatalkan", tanpa detail teknis |
| 3 | "Daftar dengan Google" di `/daftar` | Sama seperti #1; peran tetap kosong |
| 4 | Akun Google baru membuka `/dashboard/guru` | Diarahkan ke pelengkapan profil/menunggu |
| 5 | Admin menyetujui → masuk ulang | Diarahkan ke dashboard sesuai peran |
| 6 | Admin menonaktifkan akun → muat ulang halaman | Dikeluarkan, pesan "akun dinonaktifkan" |
| 7 | `/auth/callback?next=//evil.example&code=x` | Tidak pernah diarahkan ke domain lain |
| 8 | Tombol **Keluar** | Sesi hilang; halaman privat meminta login |
| 9 | Tautkan Google dari `/akun` | Metode Google tampil "tertaut"; peran tidak berubah |
| 10 | Callback dari origin yang tidak terdaftar | Ditolak Google/Supabase |
