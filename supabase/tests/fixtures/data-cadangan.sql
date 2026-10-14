-- Data FIKTIF untuk uji backup → pulih. Sengaja memuat karakter sulit
-- (tab, baris baru, garis miring terbalik, emoji, kutip) untuk menguji COPY.
insert into auth.users (id, email, last_sign_in_at) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@contoh.test', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa@contoh.test', null);
update public.profiles set role = 'admin', status = 'active', full_name = 'Admin Contoh' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'siswa', status = 'active', full_name = E'Siswa "Kutip" O\'Contoh', class_name = 'X-1'
 where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin_website');

insert into public.news (slug, title, excerpt, content, content_html, status, visibility, published_at, author_id) values
  ('berita-uji-cadangan', 'Berita Uji Cadangan ✓', E'Ringkasan\tdengan tab', E'Baris 1\nBaris 2 \\ garis miring',
   '<p>Isi <strong>uji</strong> 🎓</p>', 'published', 'public', now(), '00000000-0000-0000-0000-00000000000a');
update public.news set title = 'Berita Uji Cadangan (revisi)' where slug = 'berita-uji-cadangan';
update public.site_profile set phone = '0411-000000', hero_title = 'Judul hero uji';

insert into public.academic_years (id, name, starts_on, ends_on, is_active) values
  ('10000000-0000-4000-8000-000000000001', '2026/2027', '2026-07-13', '2027-06-30', true);
insert into public.semesters (id, academic_year_id, term, starts_on, ends_on, is_active) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, '2026-07-13', '2026-12-19', true);
insert into public.schedule_entries (semester_id, class_name, day_of_week, start_time, end_time, subject) values
  ('20000000-0000-4000-8000-000000000001', 'X-1', 1, '07:30', '09:00', 'Mapel Uji');
insert into public.decrees (number, title, issued_on, file_path, file_size, verified_at, is_published) values
  ('421/UJI/2026', 'SK Uji Cadangan', '2026-07-13', 'sk/2026/07/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 1234, now(), true);
insert into storage.objects (bucket_id, name) values
  ('documents', 'sk/2026/07/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf'),
  ('site-media', '2026/10/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg');
insert into public.newsletter_subscribers (email, status, consent_policy_version, consent_text)
  values ('pelanggan@contoh.test', 'pending', '2026-10-14', 'Setuju (uji)');
insert into public.rasa_reports (id, reference_code, pin_salt, pin_hash, category, content, last_sender) values
  ('60000000-0000-4000-8000-000000000001', 'RSA-AB23-CD45', repeat('a', 32), repeat('b', 64), 'perundungan', 'v1.SANDI-TIRUAN-UNTUK-UJI-BACKUP-LAPORAN', 'bk');
insert into public.rasa_messages (report_id, sender, content) values
  ('60000000-0000-4000-8000-000000000001', 'bk', 'v1.SANDI-TIRUAN-UNTUK-UJI-BACKUP-PESAN-BK');
insert into public.admin_audit_log (actor_id, action, details) values
  ('00000000-0000-0000-0000-00000000000a', 'uji.manual', '{"catatan": "baris log uji"}');
