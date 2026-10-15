# Panduan Ruang Rasa

Ruang Rasa adalah kanal pelaporan perundungan/kekerasan di sekolah. Siswa boleh melapor
**tanpa menyebut nama**, memperoleh **kode referensi** dan **PIN**, lalu memakainya untuk
membaca balasan Guru BK. Dokumen ini untuk Super Admin, Guru BK, dan petugas teknis.

> **Status:** kode selesai dan diuji otomatis (database, enkripsi, tes statis, uji browser
> dengan server Supabase tiruan). **Belum diuji dengan Supabase, Resend, dan hosting
> sungguhan.** Jangan membuka fitur ini ke siswa sebelum daftar uji go-live (bagian 7)
> lulus dan sekolah menyiapkan prosedur darurat (bagian 6).

## 1. Keputusan sekolah yang diterapkan

| Topik | Keputusan |
|-------|-----------|
| Siapa yang boleh membaca laporan | **Hanya Guru BK yang ditugaskan.** Super Admin, Admin Website, Petugas Administrasi, Guru BK yang tidak ditugaskan, guru, dan siswa tidak bisa membaca isi laporan |
| Masa simpan | Laporan **selesai** dihapus otomatis setelah **12 bulan** (dapat diubah 3–60 bulan). Laporan yang belum selesai tidak dihapus |
| Pemberitahuan | Dashboard + email singkat **tanpa isi laporan** (tanpa kategori dan tingkat urgensi) |
| Anonimitas | Pelapor boleh anonim; sistem tidak menyimpan identitas pelapor. Kontak adalah isian opsional di dalam isi laporan |

## 2. Alur singkat

1. Siswa membuka **/ruang-rasa**, memilih kategori, menulis cerita (waktu, tempat, dan
   kontak opsional), lalu mengirim.
2. Layar menampilkan **kode** (`RSA-XXXX-XXXX`) dan **PIN** (`XXXX-XXXX`) **satu kali**.
   Sistem tidak dapat menampilkannya lagi dan tidak dapat memulihkan PIN yang hilang.
3. Guru BK yang ditugaskan menerima email singkat, masuk ke
   **Dashboard → Ruang Rasa**, membuka laporan, membalas, dan mengubah status
   (baru → diproses → selesai).
4. Siswa membuka **/ruang-rasa/cek**, memasukkan kode + PIN, membaca balasan, dan
   dapat membalas selama laporan belum selesai.
5. Laporan selesai dihapus otomatis setelah masa simpan oleh tugas cron harian.

## 3. Pemasangan (petugas teknis + Super Admin)

1. **Buat kunci enkripsi** (sekali, di komputer petugas):
   ```bash
   openssl rand -base64 32
   ```
2. Isi nilainya sebagai `RASA_ENCRYPTION_KEY` di environment hosting, lalu redeploy.
   **Simpan salinannya di pengelola kata sandi sekolah, terpisah dari backup database.**
   Tanpa kunci ini Ruang Rasa menolak laporan dan menampilkan pesan "sedang disiapkan".
3. Pastikan migrasi `20261020000100_ruang_rasa.sql` sudah diterapkan
   (`/admin/status` menampilkan migrasi terakhir).
4. Pastikan akun Guru BK sudah dibuat, diverifikasi, dan berperan **Guru BK** di
   **Admin → Pengguna**.
5. Buka **Admin → Ruang Rasa**:
   - **Tugaskan** satu atau dua Guru BK sebagai petugas (disarankan dua agar ada cadangan).
   - Isi **Catatan prosedur darurat** (tampil di formulir siswa; lihat bagian 6).
   - Atur **masa simpan** bila perlu.
6. Pastikan email berfungsi (`EMAIL_PROVIDER=resend`, lihat `langganan-berita-email.md`).
   Tanpa email, laporan tetap masuk; petugas hanya tidak diberi tahu, jadi petugas harus
   memeriksa dashboard secara rutin.
7. Jalankan daftar uji go-live (bagian 7).

## 4. Prosedur harian Guru BK

- Buka **Dashboard → Ruang Rasa** minimal **setiap hari sekolah** (jangan hanya menunggu email).
- Laporan bertanda **Mendesak** dibaca lebih dulu.
- Membuka satu laporan **dicatat** (siapa dan kapan, tanpa isi). Daftar laporan tidak
  mencatat apa pun. Jangan membuka laporan tanpa keperluan.
- Balas dengan tenang dan jangan menuntut pelapor menyebut identitas.
- Jangan menyalin isi laporan ke aplikasi lain (chat, dokumen, tangkapan layar) tanpa
  keperluan penanganan.
- Ubah status ke **Diproses** saat mulai menangani dan ke **Selesai** bila tuntas. Setelah
  selesai, pelapor tidak dapat mengirim pesan lagi dan hitungan masa simpan dimulai.
- Tindak lanjut di dunia nyata (memanggil pihak terkait, melapor ke kepala sekolah/dinas/
  pihak berwenang) mengikuti kebijakan sekolah; aplikasi tidak melakukannya.

## 5. Model privasi dan batasnya (baca dengan jujur)

**Yang dilakukan sistem**
- Tabel Ruang Rasa tidak dapat diakses langsung oleh pengunjung maupun akun login; akses
  hanya lewat fungsi database khusus yang memeriksa penugasan Guru BK.
- Isi laporan dan pesan **dienkripsi AES-256-GCM di aplikasi** sebelum masuk database.
  Database dan backup hanya berisi teks sandi.
- PIN disimpan sebagai hash (scrypt); kode dan PIN salah memberi pesan yang sama
  (tidak membocorkan apakah kode ada). Percobaan dibatasi per alamat dan per kode.
- Tidak ada alamat IP, nama, atau akun pelapor yang disimpan. Alamat IP hanya dipakai
  sebagai kunci pembatas laju dalam bentuk hash.
- Laporan tidak pernah masuk buletin, berita, atau halaman publik; tes otomatis di CI
  menggagalkan perubahan yang mencoba menghubungkannya.
- Super Admin hanya melihat jumlah, daftar petugas, dan catatan akses (tanpa isi).

**Yang tidak dapat dijamin**
- Orang yang memegang **sekaligus** akses database dan kunci di environment hosting
  secara teknis dapat mendekripsi laporan. Batasi kedua akses itu pada sedikit orang
  tepercaya dan aktifkan 2FA.
- Kunci hilang atau diganti = **laporan lama tidak dapat dibaca lagi**. Rotasi kunci
  (enkripsi ulang) belum tersedia; jangan mengganti kunci tanpa rencana.
- Anonimitas bergantung pada pelapor: isi cerita atau kontak yang ditulis sendiri dapat
  mengungkap identitas. Formulir mengingatkan hal ini.
- Pelapor yang kehilangan kode/PIN tidak dapat memulihkannya; ia harus melapor ulang
  atau menemui Guru BK.
- Email pemberitahuan **belum diuji** dengan layanan email sungguhan.

**Backup:** backup database hanya berisi teks sandi, sehingga aman disimpan, tetapi tidak
berguna tanpa `RASA_ENCRYPTION_KEY`. Simpan kunci **terpisah** dari file backup.

## 6. Yang harus disiapkan sekolah (bukan tugas aplikasi)

Ruang Rasa **bukan layanan darurat** dan **tidak dipantau 24 jam**. Sekolah wajib:

1. Menulis **prosedur darurat** (siapa dihubungi, nomor, jam layanan) dan mengisinya di
   **Admin → Ruang Rasa → Catatan prosedur darurat**. Formulir juga menampilkan nomor 112.
2. Menetapkan **siapa yang menangani** saat Guru BK berhalangan, dan batas waktu respons
   yang disampaikan kepada siswa dengan jujur.
3. Menyiapkan **teks persetujuan/pemberitahuan** untuk siswa di bawah umur dan orang tua
   sesuai kebijakan sekolah dan aturan perlindungan data/anak yang berlaku. Minta ditinjau
   pihak yang berwenang; dokumen ini bukan nasihat hukum.
4. Menentukan aturan **pelaporan ke pihak berwenang** untuk kasus serius (kekerasan,
   pelecehan, ancaman keselamatan) dan siapa yang berhak memutuskannya.
5. Mensosialisasikan Ruang Rasa kepada siswa, termasuk cara menyimpan kode dan PIN.

## 7. Daftar uji go-live (dengan Supabase, hosting, dan email sungguhan)

Gunakan akun uji dan hapus datanya setelah selesai.

- [ ] `RASA_ENCRYPTION_KEY` terisi; `/admin/status` tidak memberi peringatan Ruang Rasa
- [ ] Kirim laporan uji dari perangkat lain tanpa login; kode dan PIN tampil sekali
- [ ] Di Supabase Table Editor, tabel `rasa_reports` **tidak** menampilkan teks laporan
      (hanya teks sandi) dan Table Editor/anon key tidak dapat membaca tabel Rasa lewat API
- [ ] `/ruang-rasa/cek` dengan kode + PIN benar menampilkan laporan; PIN salah dan kode
      tak dikenal memberi pesan yang sama
- [ ] Guru BK yang ditugaskan melihat laporan; Guru BK lain, Super Admin, dan siswa tidak
- [ ] Email singkat diterima petugas dan **tidak** memuat isi laporan
- [ ] Balasan Guru BK terlihat oleh pelapor; balasan pelapor terlihat oleh Guru BK
- [ ] Setelah status **Selesai**, pelapor tidak dapat mengirim pesan lagi
- [ ] Catatan akses di **Admin → Ruang Rasa** mencatat pembukaan laporan tanpa isi
- [ ] Backup database tidak memuat teks laporan terbaca; kunci tersimpan terpisah
- [ ] Penghapusan otomatis dicoba: ubah masa simpan sementara ke nilai terendah pada
      data uji yang sudah selesai, jalankan cron, lalu kembalikan
- [ ] Prosedur darurat dan teks persetujuan dari sekolah sudah terpasang

## 8. Pemecahan masalah

| Gejala | Penyebab / tindakan |
|--------|----------------------|
| Siswa melihat "sedang disiapkan" | `RASA_ENCRYPTION_KEY` belum diisi atau tidak valid (harus base64 dari 32 byte) |
| Petugas tidak mendapat email | Penyedia email belum aktif atau gagal; periksa dashboard secara rutin dan log hosting |
| Guru BK tidak melihat laporan | Belum ditugaskan di **Admin → Ruang Rasa**, atau akun belum aktif/berperan Guru BK |
| Laporan lama tampil rusak/tak terbaca | Kunci berbeda dari yang dipakai saat laporan dibuat; pulihkan kunci lama |
| Pelapor lupa PIN | Tidak dapat dipulihkan; sarankan melapor ulang atau menemui Guru BK |
| Terlalu banyak percobaan | Pembatas laju aktif; tunggu 15 menit |
