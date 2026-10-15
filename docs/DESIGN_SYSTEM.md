# Design System "Modern Academic"

Diterapkan di Tahap 2. Token didefinisikan di `src/app/globals.css` (blok `@theme`).

## Warna

| Token | Nilai | Pemakaian |
|-------|-------|-----------|
| `navy-900` | `#102B50` | Warna utama: judul, tombol utama, hero, footer (`navy-950`) |
| `teal-600` | `#168AAD` | Aksen besar/dekoratif, garis fokus. **Bukan** untuk teks kecil (kontras 4,0:1) |
| `teal-700` | `#11708D` | Tautan dan teks aksen (kontras 5,6:1 di atas putih) |
| `gold-500` | `#D9AE52` | Tombol sorotan di atas navy, lencana, garis aksen. **Jangan** sebagai teks di atas putih |
| `surface` | `#F4F7FB` | Latar halaman (cool white) |
| Putih & `slate-*` | — | Kartu, teks isi, garis |

Alias lama (`brand-*`, `accent-*`) dipetakan ke palet ini sehingga halaman admin dan
dashboard ikut berubah tanpa diedit satu per satu.

## Tipografi

- **Plus Jakarta Sans Variable** (lisensi OFL), di-*self-host* lewat paket
  `@fontsource-variable/plus-jakarta-sans`. Tidak ada permintaan ke Google Fonts dari
  browser pengunjung.
- Judul: `font-bold`/`extrabold`, `tracking-tight`. Isi artikel: 17 px, `line-height` 1,85,
  lebar baca maksimal ±70 karakter (`max-w-3xl`).

## Komponen

| Kelas / komponen | Fungsi |
|------------------|--------|
| `.btn-primary`, `.btn-secondary`, `.btn-gold`, `.btn-ghost-light`, `.btn-danger` | Tombol |
| `.card`, `.card-hover` | Kartu dan efek angkat ringan |
| `.eyebrow`, `.section-title` | Label kecil & judul bagian |
| `.hero-pattern`, `.hero-grid` | Latar hero geometris (pengganti foto sampai foto resmi tersedia) |
| `SchoolMark` | Logo resmi bila `NEXT_PUBLIC_SCHOOL_LOGO_URL` diisi; jika tidak, monogram netral |
| `NewsCard`, `FeaturedNewsCard`, `CompactNewsItem` | Kartu berita. Tanpa gambar → tidak memakai foto pengganti |

## Prinsip

- **Tidak ada data atau foto palsu.** Bagian beranda (program, prestasi, galeri, kalender,
  Ruang Rasa) baru tampil setelah modulnya ada dan berisi data nyata. Pita Ruang Rasa di
  beranda memang selalu tampil: berisi ajakan melapor, bukan data.
- **Animasi ringan** (fade-in hero, angkat kartu) dan otomatis dimatikan bila pengguna
  memilih *reduce motion*.
- **Responsif**: diuji di 390 px (ponsel), 820 px (tablet), 1440 px (desktop) tanpa
  scroll horizontal. Menu ponsel memakai `<details>` sehingga berfungsi tanpa JavaScript.
- Formulir langganan di footer otomatis disembunyikan bila halaman sudah memuat formulir
  yang sama (CSS `:has`), agar tidak tampil dua kali.
