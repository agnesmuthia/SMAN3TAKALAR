-- Pengujian RLS dashboard guru/siswa/BK dengan data FIKTIF.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.assert(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if cond is not true then
    raise exception 'GAGAL: %', msg;
  end if;
  raise notice 'OK: %', msg;
end;
$$;

create or replace function pg_temp.try_as(p_role text, p_uid uuid, p_sql text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
  exception when others then
    reset role;
    return sqlstate || ':' || sqlerrm;
  end;
  reset role;
  return 'ok';
end;
$$;

create or replace function pg_temp.count_as(p_role text, p_uid uuid, p_sql text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute format('set local role %I', p_role);
  execute p_sql into v;
  reset role;
  return v;
end;
$$;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'adminweb@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa@contoh.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'pending@contoh.test');
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'guru', status = 'active'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
update public.profiles set role = 'siswa', status = 'active', class_name = 'X-1' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.staff_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin_website'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor');

-- ---------------------------------------------------------------------------
-- Profil sekolah
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.site_profile') = 1,
  'profil sekolah dapat dibaca publik');
select pg_temp.try_as('anon', null, $q$update public.site_profile set phone = '000'$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'pengunjung tidak dapat mengubah profil sekolah');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2', $q$update public.site_profile set phone = '000'$q$) as hasil \gset
select pg_temp.assert((select phone is null from public.site_profile), 'editor berita tidak dapat mengubah profil sekolah');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1', $q$update public.site_profile set phone = '0411-000000', instagram_url = 'https://instagram.com/contoh'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok' and (select phone from public.site_profile) = '0411-000000', 'Admin Website memperbarui profil sekolah');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1', $q$update public.site_profile set instagram_url = 'javascript:alert(1)'$q$) like '23514%',
  'URL media sosial wajib https');

-- ---------------------------------------------------------------------------
-- Halaman & program
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.site_pages (id, slug, title, is_published) values
       ('e0000000-0000-0000-0000-000000000001', 'visi-misi', 'Visi dan Misi', true),
       ('e0000000-0000-0000-0000-000000000002', 'sejarah', 'Sejarah', false)$q$) = 'ok',
  'Admin Website membuat halaman');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.site_pages (slug, title) values ('liar', 'Halaman liar')$q$) like '42501%',
  'editor berita tidak dapat membuat halaman');
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.site_pages') = 1,
  'pengunjung hanya melihat halaman yang diterbitkan');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select count(*) from public.site_pages') = 2,
  'Admin Website melihat halaman draf');

insert into public.school_programs (title, is_published) values ('Program Terbit', true), ('Program Draf', false);
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.school_programs') = 1,
  'pengunjung hanya melihat program yang diterbitkan');

-- ---------------------------------------------------------------------------
-- Galeri
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.gallery_albums (id, slug, title, is_published) values
       ('f0000000-0000-0000-0000-000000000001', 'tanpa-izin', 'Album tanpa izin', true)$q$) like '23514%',
  'album tidak dapat diterbitkan tanpa konfirmasi izin publikasi');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$insert into public.gallery_albums (id, slug, title, is_published, consent_confirmed_at, consent_confirmed_by) values
     ('f0000000-0000-0000-0000-000000000001', 'album-terbit', 'Album terbit', true, now(), '00000000-0000-0000-0000-0000000000a1'),
     ('f0000000-0000-0000-0000-000000000002', 'album-draf', 'Album draf', false, null, null)$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'Admin Website membuat album (terbit dengan izin & draf)');
insert into public.gallery_photos (album_id, image_url) values
  ('f0000000-0000-0000-0000-000000000001', 'https://contoh.test/a.jpg'),
  ('f0000000-0000-0000-0000-000000000002', 'https://contoh.test/rahasia.jpg');
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.gallery_photos') = 1,
  'foto dari album draf tidak terlihat publik');
select pg_temp.assert(
  pg_temp.try_as('anon', null, $q$insert into public.gallery_photos (album_id, image_url) values ('f0000000-0000-0000-0000-000000000001', 'https://x.test/a.jpg')$q$) like '42501%',
  'pengunjung tidak dapat menambah foto');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.gallery_photos (album_id, image_url) values ('f0000000-0000-0000-0000-000000000001', 'https://x.test/a.jpg')$q$) like '42501%',
  'editor berita tidak dapat menambah foto galeri');

-- ---------------------------------------------------------------------------
-- Prestasi
-- ---------------------------------------------------------------------------
insert into public.achievements (title, level, achieved_on, is_published) values
  ('Juara 1 (contoh)', 'provinsi', '2026-09-01', true),
  ('Draf prestasi', 'kabupaten', '2026-08-01', false);
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.achievements') = 1,
  'pengunjung hanya melihat prestasi yang diterbitkan');

-- ---------------------------------------------------------------------------
-- Kalender
-- ---------------------------------------------------------------------------
insert into public.calendar_events (title, starts_on, ends_on, visibility, is_published) values
  ('Ujian semester (publik)', '2026-12-01', '2026-12-07', 'public', true),
  ('Rapat guru (internal)', '2026-12-02', '2026-12-02', 'internal', true),
  ('Draf kegiatan', '2026-12-03', '2026-12-03', 'public', false);
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.calendar_events') = 1,
  'pengunjung hanya melihat kegiatan publik yang diterbitkan');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.calendar_events') = 2,
  'siswa aktif juga melihat kegiatan internal');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000d1', 'select count(*) from public.calendar_events') = 1,
  'akun pending tidak melihat kegiatan internal');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.calendar_events (title, starts_on, ends_on) values ('Terbalik', '2026-12-05', '2026-12-01')$q$) like '23514%',
  'tanggal selesai tidak boleh sebelum tanggal mulai');

-- ---------------------------------------------------------------------------
-- Pengumuman publik
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.announcements (title, audience, status, published_at) values
       ('Pengumuman publik (contoh)', 'publik', 'published', now() - interval '1 hour'),
       ('Pengumuman internal (contoh)', 'semua', 'published', now() - interval '1 hour'),
       ('Draf publik (contoh)', 'publik', 'draft', null)$q$) = 'ok',
  'Admin Website kini dapat mengelola pengumuman');
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.announcements') = 1,
  'pengunjung hanya membaca pengumuman publik yang terbit');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.announcements') = 2,
  'siswa membaca pengumuman publik + "semua"');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.announcements (title, audience, status, published_at) values ('Editor', 'publik', 'published', now())$q$) like '42501%',
  'editor berita tidak dapat membuat pengumuman');

-- Bucket media situs tersedia.
select pg_temp.assert((select public from storage.buckets where id = 'site-media'), 'bucket media situs dibuat');

rollback;
\echo 'Pengujian konten situs lulus.'
