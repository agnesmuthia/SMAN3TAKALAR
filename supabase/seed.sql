-- Data FIKTIF untuk pengembangan lokal (`supabase db reset`). Jangan
-- dijalankan di produksi. Tidak berisi data pribadi sungguhan.

insert into public.news (slug, title, excerpt, content, status, visibility, published_at, cover_image_url) values
  ('penerimaan-peserta-didik-baru-fiktif',
   'Informasi Penerimaan Peserta Didik Baru (Contoh)',
   'Contoh berita publik untuk menguji tampilan daftar berita dan buletin email.',
   E'Ini adalah berita contoh.\n\nSeluruh isi berita ini fiktif dan hanya untuk pengujian.',
   'published', 'public', now() - interval '2 days', null),
  ('juara-lomba-sains-fiktif',
   'Siswa Meraih Juara Lomba Sains (Contoh)',
   'Contoh berita publik kedua.',
   E'Paragraf pertama berita contoh.\n\nParagraf kedua berita contoh.',
   'published', 'public', now() - interval '1 day', null),
  ('rapat-internal-guru-fiktif',
   'Rapat Internal Guru (Contoh Internal)',
   'Berita internal: tidak boleh tampil publik atau masuk buletin.',
   'Isi internal fiktif.',
   'published', 'internal', now() - interval '1 day', null),
  ('draf-kegiatan-fiktif',
   'Draf Kegiatan Sekolah (Contoh Draf)',
   'Berita draf: tidak boleh tampil publik atau masuk buletin.',
   'Isi draf fiktif.',
   'draft', 'public', null, null)
on conflict (slug) do nothing;

insert into public.school_roster (kind, identifier, full_name, class_name) values
  ('guru', '199001012020011001', 'Guru Contoh Satu', null),
  ('siswa', '0012345678', 'Siswa Contoh Satu', 'X-1')
on conflict (kind, identifier) do nothing;
