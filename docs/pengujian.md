# Pengujian

Semua pengujian memakai **data fiktif**.

## Menjalankan

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest: logika keamanan, token, template, pengiriman
npm run test:db     # Migrasi + RLS + alur langganan di PostgreSQL sementara
npm run build       # Build produksi
```

`npm run test:db` membutuhkan binari PostgreSQL (`initdb`, `pg_ctl`, `psql`). Skrip
membuat klaster sementara, memasang stub minimal skema `auth` Supabase
(`supabase/tests/00_supabase_stub.sql`), menerapkan semua migrasi, menjalankan
semua berkas `supabase/tests/1*.sql` (alur & RLS: `10_rls_dan_alur`, `11_dashboard`,
`12_cms_berita`, `13_konten_situs`, `14_administrasi`), lalu menghapus klaster. Database Supabase
sungguhan tidak disentuh.

## Pemetaan skenario wajib

Keterangan: **Otomatis** = dicakup pengujian di repo; **Manual** = harus diuji setelah
kredensial/konfigurasi nyata tersedia (lihat daftar uji di dokumen terkait).

| # | Skenario | Status | Bukti |
|---|----------|--------|-------|
| 1 | Login Google berhasil setelah konfigurasi | **Manual** (butuh Client ID/Secret asli) | `docs/google-oauth.md` §6 |
| 2 | Login Google gagal dengan pesan aman | Otomatis (sebagian) + Manual | Callback hanya memakai kode pesan terdaftar (`src/lib/auth/messages.ts`); smoke test `/auth/callback` |
| 3 | Pengguna baru tidak otomatis guru/siswa | Otomatis | DB: "pengguna Google baru: role NULL…"; unit: `resolvePostLoginDestination` |
| 4 | Akun pending tidak bisa membuka fitur privat | Otomatis | DB: "akun pending tidak dapat membaca berita internal"; unit: routing |
| 5 | Guru & siswa memperoleh hak sesuai peran | Otomatis | DB: "guru aktif dapat membaca berita internal", "guru tidak dapat mengangkat dirinya menjadi admin"; unit: `canAccessPath` |
| 6 | Pengunjung membaca berita tanpa login | Otomatis | DB: "pengunjung tanpa login hanya membaca berita publik…"; smoke test `/berita` = 200 |
| 7 | Berlangganan tanpa akun website | Otomatis (logika) + Manual (email) | Formulir publik tanpa login; tabel pelanggan terpisah dari `profiles` |
| 8 | Email konfirmasi benar-benar dikirim | **Manual** (butuh domain & API key Resend) | `docs/langganan-berita-email.md` §9 |
| 9 | Langganan tidak aktif sebelum konfirmasi | Otomatis | DB: "langganan tidak aktif sebelum konfirmasi", "antrean hanya berisi pelanggan aktif" |
| 10 | Berita draf tidak pernah terkirim | Otomatis | DB: trigger menolak draf/internal/terjadwal; unit: `isDistributableNews` |
| 11 | Berita publik yang disetujui dapat dikirim | Otomatis (logika) + Manual (email) | DB: "berita publik yang terbit dapat dimasukkan"; unit: `processCampaignBatch` |
| 12 | Unsubscribe berhasil & mencegah pengiriman berikutnya | Otomatis | DB: "alamat yang berhenti berlangganan tidak menerima buletin berikutnya"; unit: token HMAC |
| 13 | Pengiriman ulang tanpa duplikasi | Otomatis | DB: "enqueue ulang tidak membuat duplikat", "tidak diklaim dua kali"; unit: idempotensi & retry |
| 14 | Alamat pelanggan tidak terlihat pelanggan lain | Otomatis | Unit: satu penerima per email, isi email tidak memuat alamat lain; `ResendProvider` menolak banyak penerima |
| 15 | Data Ruang Rasa tidak muncul di buletin | Otomatis | Unit: `toNewsletterArticle` hanya meneruskan kolom publik; template diuji dengan kolom terlarang |
| 16 | Semua rahasia di environment variables | Diperiksa saat review | `.env.example` hanya placeholder; modul rahasia memakai `server-only` sehingga build gagal bila diimpor dari komponen klien |
| 17 | Lint, type check, build, pengujian | Otomatis | Perintah di atas |

## Pengujian manual yang disarankan sebelum rilis

- Uji semua daftar di `docs/google-oauth.md` §6 dan `docs/langganan-berita-email.md` §9.
- Uji akses langsung ke API Supabase dengan anon key (mis. `curl` ke
  `/rest/v1/newsletter_subscribers`) → harus ditolak.
- Uji tampilan di ponsel (lebar 360–414 px) dan pembaca layar dasar.

## Konten situs (Tahap 4)

| Skenario | Status | Bukti |
|----------|--------|-------|
| Pengunjung hanya melihat halaman/program/album/prestasi/kegiatan yang diterbitkan | Otomatis | DB `13_konten_situs.sql` |
| Kegiatan internal hanya untuk anggota aktif | Otomatis | DB: "pengunjung hanya melihat kegiatan publik yang diterbitkan", "siswa aktif juga melihat kegiatan internal", "akun pending tidak melihat kegiatan internal" |
| Album tidak dapat terbit tanpa konfirmasi izin foto | Otomatis | DB: constraint `gallery_publish_needs_consent` |
| Editor berita tidak dapat mengubah konten situs/pengumuman | Otomatis | DB: "editor berita tidak dapat membuat halaman", "… membuat pengumuman" |
| Pengumuman internal tidak terbaca pengunjung; pengumuman publik terbaca | Otomatis | DB `11_dashboard.sql`, `13_konten_situs.sql` |
| Grid kalender (mulai Senin, kegiatan beberapa hari) | Otomatis | unit `tests/calendar.test.ts` |
| Unggah foto ke bucket `site-media` | **Manual** (butuh proyek Supabase nyata) | `docs/PANDUAN_MENGELOLA_HALAMAN.md` §4 |

## Administrasi sekolah (Tahap 5)

| Skenario | Status | Bukti |
|----------|--------|-------|
| Hanya Super Admin & Petugas Administrasi mengelola tahun ajaran/semester/SK | Otomatis | DB `14_administrasi.sql`: "Admin Website tidak dapat membuat tahun ajaran", "… mengelola arsip SK" |
| Hanya satu semester aktif | Otomatis | DB: "hanya satu semester aktif; tahun ajarannya ikut aktif" |
| Impor tidak menimpa data lama; batch tidak dapat diimpor dua kali; pembatalan hanya menghapus baris batch | Otomatis | DB: "impor tidak menimpa jadwal yang sudah ada", "membatalkan impor hanya menghapus baris dari batch tersebut" |
| Pembacaan CSV/XLSX, laporan per baris, duplikat, bentrok guru/kelas, batas baris | Otomatis | unit `tests/schedule-import.test.ts` (termasuk file XLSX nyata `tests/fixtures/jadwal-contoh.xlsx`) |
| Validasi PDF (isi, ukuran, skrip) | Otomatis | unit `tests/pdf.test.ts` |
| SK tidak tampil sebelum diperiksa; SK internal hanya untuk anggota aktif | Otomatis | DB: "SK tidak dapat ditampilkan sebelum diperiksa", "akun pending tidak melihat SK internal" |
| Bucket dokumen privat | Otomatis | DB: "bucket dokumen bersifat privat" |
| Unggah/unduh PDF ke Supabase Storage nyata (tautan sementara) | **Manual** (butuh proyek Supabase nyata) | `docs/PANDUAN_ADMINISTRASI_SEKOLAH.md` §5 |

