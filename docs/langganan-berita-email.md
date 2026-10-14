# Langganan Berita melalui Email

Pengunjung umum dapat berlangganan berita sekolah **tanpa akun website**, dengan
konfirmasi email (double opt-in), dan dapat berhenti kapan saja tanpa login.

> **Status:** kode, database, dan pengujian otomatis sudah siap. **Pengiriman email
> sungguhan belum aktif** sampai penyedia email dan domain pengirim dikonfigurasi
> serta diuji. Sebelum itu, formulir menampilkan "Layanan langganan email belum
> aktif" dan buletin tidak dapat dikirim.

## 1. Pemilihan penyedia email

Implementasi awal memakai **Resend** (API HTTP, tanpa SMTP PHP). Evaluasi singkat:

| Kebutuhan | Resend | Catatan |
|-----------|--------|---------|
| Email konfirmasi & buletin | Ya | Satu panggilan API per penerima |
| Template HTML | Ya | Template dibuat aplikasi (`src/lib/newsletter/template.ts`) |
| Status pengiriman, bounce, keluhan spam | Ya, lewat webhook | Endpoint `/api/newsletter/webhook` |
| Idempotensi (cegah email ganda saat retry) | Ya (`Idempotency-Key`) | Kunci: `newsletter-<kampanye>-<pelanggan>` |
| Header List-Unsubscribe (sekali klik) | Ya (header kustom) | Endpoint `/api/newsletter/unsubscribe` |
| Domain pengirim khusus + SPF/DKIM | Ya | Wajib sebelum mengirim |

Batas paket gratis dan laju API dapat berubah. **Periksa batas terbaru di dasbor
Resend** dan sesuaikan `NEWSLETTER_SEND_DELAY_MS` / `NEWSLETTER_BATCH_SIZE`.
Alternatif bila anggaran/kebutuhan berbeda: Brevo, Amazon SES, Postmark. Untuk
berganti penyedia, tambahkan kelas baru yang mengimplementasikan `EmailProvider` di
`src/lib/newsletter/provider.ts`.

Jangan memakai fungsi `mail()` PHP atau SMTP hosting biasa untuk buletin.

## 2. Menyiapkan Resend

1. Buat akun di <https://resend.com> memakai email resmi sekolah.
2. **Domains → Add domain**. Disarankan subdomain khusus, mis. `kabar.sman3takalar.sch.id`,
   agar reputasi email utama sekolah tidak terpengaruh.
3. Tambahkan record DNS yang ditampilkan Resend di pengelola DNS domain sekolah:
   - **SPF**: record TXT (biasanya pada subdomain `send.`) yang mengizinkan server Resend.
   - **DKIM**: record TXT `resend._domainkey...` berisi kunci publik.
   - **MX** untuk bounce (bila diminta Resend).
   - **DMARC** (dikelola sekolah, bukan Resend): mulai dengan pemantauan, mis.
     `_dmarc.kabar.sman3takalar.sch.id TXT "v=DMARC1; p=none; rua=mailto:dmarc@sman3takalar.sch.id"`.
     Setelah beberapa minggu tanpa masalah, naikkan ke `p=quarantine`.
4. Tunggu status domain **Verified**. **Jangan mengirim sebelum terverifikasi.**
5. Matikan **open tracking** dan **click tracking** untuk domain ini (privasi pembaca).
6. **API Keys → Create** dengan izin *Sending access* saja untuk domain tersebut.
7. Isi environment variables di hosting (bukan di repository):
   ```
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=<dari Resend>
   EMAIL_FROM="Berita SMAN 3 Takalar <berita@kabar.sman3takalar.sch.id>"
   NEWSLETTER_TOKEN_SECRET=<openssl rand -base64 48>
   ```
8. **Webhooks → Add endpoint**: `https://<domain>/api/newsletter/webhook`, pilih event
   `email.delivered`, `email.bounced`, `email.complained`. Salin *signing secret*
   (`whsec_...`) ke `RESEND_WEBHOOK_SECRET`.
9. (Disarankan) Pakai Resend juga sebagai SMTP kustom Supabase Auth agar email
   konfirmasi akun terkirim andal.

## 3. Penjadwal (cron)

Pengiriman dilakukan bertahap. Gelombang pertama dikirim saat admin menyetujui
kampanye; sisanya dilanjutkan oleh:

- tombol **Lanjutkan pengiriman** di halaman kampanye, atau
- penjadwal yang memanggil `GET /api/cron/newsletter` dengan header
  `Authorization: Bearer <CRON_SECRET>`.

`vercel.json` menjadwalkan sekali sehari (batas paket Hobby Vercel). Untuk daftar
pelanggan besar, gunakan paket yang mengizinkan cron lebih sering atau layanan cron
eksternal setiap 5–10 menit dengan header yang sama. Endpoint yang sama menjalankan
pembersihan retensi (`newsletter_purge_stale`).

## 4. Alur data

```
Formulir (email + centang persetujuan + honeypot)
  → validasi server, rate limit per IP (hash) & per email
  → newsletter_subscribers (status pending, bukti persetujuan & versi kebijakan)
  → token acak 256-bit → hanya SHA-256-nya disimpan (berlaku 48 jam, sekali pakai)
  → email konfirmasi
Pengguna klik tautan → halaman konfirmasi → tombol "Ya, saya ingin berlangganan" (POST)
  → newsletter_confirm() → status active
Admin membuat kampanye (draf) → pratinjau → centang persetujuan → kirim
  → newsletter_enqueue_campaign(): hanya pelanggan aktif & tidak ada di daftar penolakan
  → newsletter_claim_deliveries() (FOR UPDATE SKIP LOCKED) → 1 email per penerima
  → status "Diterima penyedia" hanya bila penyedia mengembalikan ID pesan
Berhenti berlangganan (tautan HMAC di setiap email, atau tombol bawaan klien email)
  → newsletter_unsubscribe() → status unsubscribed + hash email ke daftar penolakan
```

Respons publik formulir selalu sama ("Jika alamat tersebut dapat menerima email ...")
sehingga status langganan suatu alamat tidak bocor.

## 5. Aturan konten buletin

Hanya berita **terbit + publik + sudah lewat waktu terbit + "boleh masuk buletin"**.
Aturan ini ditegakkan di tiga lapisan:

1. Pilihan berita di formulir kampanye hanya menampilkan berita yang lolos.
2. Trigger database `newsletter_campaign_items_guard` menolak berita lain.
3. Saat pengiriman, isi diperiksa ulang (`loadCampaignContent`); berita yang berubah
   menjadi draf/internal tidak dikirim, dan kampanye berhenti bila tidak ada yang tersisa.

Template email hanya menerima judul, ringkasan, gambar https, tanggal, dan tautan.
Isi lengkap berita, dokumen SK, data siswa, dan data konseling/Ruang Rasa tidak
memiliki jalur ke modul ini.

## 6. Mode pengiriman

Di **Admin → Pengaturan**:

- **Nonaktif** (bawaan, disarankan untuk versi awal): admin menyusun & menyetujui.
- **Buat draf otomatis**: berita publik yang terbit dibuatkan draf kampanye; tetap
  menunggu persetujuan.
- **Kirim langsung**: berita publik yang terbit langsung dikirim. Gunakan hanya bila
  alur persetujuan berita sudah ketat.

## 7. Operasional admin (`/admin/langganan`)

- Statistik aktif / belum konfirmasi / berhenti, pencarian & filter.
- **Unduh CSV**: hanya pelanggan aktif; setiap unduhan dicatat di `admin_audit_log`.
  Simpan file di perangkat sekolah yang aman dan hapus setelah selesai dipakai.
- **Hapus/anonimkan**: email dihapus, hash email tetap di daftar penolakan.
- **Kampanye**: buat draf, pratinjau, setujui & kirim, lanjutkan, coba ulang yang gagal
  (kunci idempotensi sama sehingga tidak ada email ganda), batalkan.
- **Template email**: judul, pengantar, catatan kaki, warna aksen. Tautan berhenti
  berlangganan selalu ditambahkan otomatis.

## 8. Retensi data

| Data | Retensi |
|------|---------|
| Pendaftaran tidak dikonfirmasi | Dihapus otomatis setelah 30 hari |
| Token konfirmasi | Dihapus 1 hari setelah kedaluwarsa/terpakai |
| Catatan rate limit | Dihapus setelah 2 hari |
| Pelanggan berhenti | Disimpan dengan status `unsubscribed`; dapat dianonimkan admin |
| Daftar penolakan | Hanya hash SHA-256 email, untuk mencegah pengiriman ulang |
| Peristiwa webhook | Tanpa alamat email/payload mentah |

## 9. Daftar uji setelah konfigurasi nyata

1. Berlangganan dengan alamat uji milik sekolah → email konfirmasi diterima.
2. Sebelum klik konfirmasi, status di admin "Belum konfirmasi"; kampanye tidak
   mengirim ke alamat ini.
3. Klik konfirmasi → status "Aktif"; tautan yang sama kedua kali ditolak.
4. Buat kampanye dari berita publik → pratinjau → kirim ke ≥ 2 alamat uji →
   masing-masing hanya melihat alamatnya sendiri di header To.
5. Klik "Berhenti berlangganan" di email → konfirmasi → kampanye berikutnya tidak
   dikirim ke alamat itu.
6. Uji tombol unsubscribe bawaan Gmail (List-Unsubscribe).
7. Kirim ke alamat bounce simulator Resend → status "Bounce" dan alamat masuk daftar penolakan.
8. Periksa header email (SPF=pass, DKIM=pass, DMARC=pass) di Gmail → "Show original".
