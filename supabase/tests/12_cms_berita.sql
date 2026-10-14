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

-- Pengguna fiktif.

-- Pengguna fiktif: admin (Super Admin), guru-penerbit, guru-editor, guru biasa, siswa.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'penerbit@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'editor2@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'guru@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa@contoh.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'pending@contoh.test');
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'guru', status = 'active'
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
              '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4');
update public.profiles set role = 'siswa', status = 'active', class_name = 'X-1' where id = '00000000-0000-0000-0000-0000000000b1';

-- ---------------------------------------------------------------------------
-- Peran staf
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a4',
    $q$select public.admin_set_staff_roles('00000000-0000-0000-0000-0000000000a4', array['admin_website']::public.staff_role[])$q$) like '42501%',
  'guru tidak dapat memberi dirinya peran staf');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a4',
    $q$insert into public.staff_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a4', 'admin_website')$q$) like '42501%',
  'peran staf tidak dapat ditulis langsung');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.admin_set_staff_roles('00000000-0000-0000-0000-0000000000d1', array['editor']::public.staff_role[])$q$) like '22023%',
  'akun pending tidak dapat diberi peran staf');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
  $q$select public.admin_set_staff_roles('00000000-0000-0000-0000-0000000000a1', array['admin_website']::public.staff_role[])$q$) as r1 \gset
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
  $q$select public.admin_set_staff_roles('00000000-0000-0000-0000-0000000000a2', array['editor']::public.staff_role[])$q$) as r2 \gset
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
  $q$select public.admin_set_staff_roles('00000000-0000-0000-0000-0000000000a3', array['editor']::public.staff_role[])$q$) as r3 \gset
select pg_temp.assert(:'r1' = 'ok' and :'r2' = 'ok' and :'r3' = 'ok', 'Super Admin menetapkan peran staf');
select pg_temp.assert(
  (select count(*) from public.admin_audit_log where action = 'user.set_staff_roles') = 3,
  'penetapan peran staf tercatat di log audit');

-- ---------------------------------------------------------------------------
-- Editor: draf & review saja
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a4',
    $q$insert into public.news (slug, title, author_id) values ('guru-biasa', 'Guru biasa menulis', '00000000-0000-0000-0000-0000000000a4')$q$) like '42501%',
  'guru tanpa peran staf tidak dapat menulis berita');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$insert into public.news (slug, title, author_id) values ('siswa-nulis', 'Siswa menulis', '00000000-0000-0000-0000-0000000000b1')$q$) like '42501%',
  'siswa tidak dapat menulis berita');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.news (id, slug, title, author_id, status, approved_by, review_note)
       values ('c0000000-0000-0000-0000-000000000001', 'draf-editor', 'Draf editor', '00000000-0000-0000-0000-0000000000a2', 'draft',
               '00000000-0000-0000-0000-0000000000a2', 'catatan palsu')$q$) = 'ok',
  'editor membuat draf');
select pg_temp.assert(
  (select approved_by is null and review_note is null from public.news where id = 'c0000000-0000-0000-0000-000000000001'),
  'editor tidak dapat mengisi kolom persetujuan sendiri');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.news (slug, title, author_id, status, published_at)
       values ('editor-terbit', 'Editor langsung terbit', '00000000-0000-0000-0000-0000000000a2', 'published', now())$q$) like '42501%',
  'editor tidak dapat langsung menerbitkan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.news (slug, title, author_id, status)
       values ('atas-nama-lain', 'Atas nama editor lain', '00000000-0000-0000-0000-0000000000a3', 'draft')$q$) like '42501%',
  'editor tidak dapat menulis atas nama orang lain');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$update public.news set status = 'published', published_at = now() where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'editor tidak dapat mengubah drafnya menjadi terbit');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$update public.news set status = 'review', title = 'Draf editor (siap ditinjau)' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'editor mengirim draf untuk persetujuan');
select pg_temp.assert(
  (select status = 'review' and submitted_at is not null from public.news where id = 'c0000000-0000-0000-0000-000000000001'),
  'waktu pengajuan tercatat');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a3', $q$select count(*) from public.news where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 0,
  'editor lain tidak melihat draf editor pertama');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$update public.news set title = 'Dibajak' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert((select title from public.news where id = 'c0000000-0000-0000-0000-000000000001') = 'Draf editor (siap ditinjau)',
  'editor lain tidak dapat mengubah draf editor pertama');
select pg_temp.assert(
  pg_temp.count_as('anon', null, $q$select count(*) from public.news where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 0,
  'berita yang menunggu persetujuan tidak terlihat publik');

-- ---------------------------------------------------------------------------
-- Penerbit (Admin Website)
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', $q$select count(*) from public.news where status = 'review'$q$) = 1,
  'penerbit melihat antrean persetujuan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$update public.news set status = 'draft', review_note = 'Tambahkan foto kegiatan' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok' and (select review_note from public.news where id = 'c0000000-0000-0000-0000-000000000001') = 'Tambahkan foto kegiatan',
  'penerbit mengembalikan berita ke draf dengan catatan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$update public.news set status = 'published', published_at = now() + interval '2 days' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'penerbit menjadwalkan berita');
select pg_temp.assert(
  (select approved_by = '00000000-0000-0000-0000-0000000000a1' and approved_at is not null and review_note is null
     from public.news where id = 'c0000000-0000-0000-0000-000000000001'),
  'penyetuju dan waktu persetujuan tercatat; catatan dibersihkan');
select pg_temp.assert(
  pg_temp.count_as('anon', null, $q$select count(*) from public.news where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 0,
  'berita terjadwal belum terlihat publik sebelum waktunya');
update public.news set published_at = now() - interval '1 minute' where id = 'c0000000-0000-0000-0000-000000000001';
select pg_temp.assert(
  pg_temp.count_as('anon', null, $q$select count(*) from public.news where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 1,
  'berita terjadwal tampil otomatis setelah waktunya tiba');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$update public.news set title = 'Editor mengubah berita terbit' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert((select title from public.news where id = 'c0000000-0000-0000-0000-000000000001') <> 'Editor mengubah berita terbit',
  'editor tidak dapat mengubah berita yang sudah terbit');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$update public.news set status = 'archived' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'penerbit mengarsipkan berita');
select pg_temp.assert(pg_temp.count_as('anon', null, $q$select count(*) from public.news where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 0,
  'berita arsip hilang dari publik');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$update public.news set status = 'draft' where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'penerbit memulihkan berita arsip menjadi draf');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$delete from public.news where id = 'c0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert((select count(*) from public.news where id = 'c0000000-0000-0000-0000-000000000001') = 1,
  'penerbit tidak dapat menghapus permanen (hanya Super Admin)');

-- ---------------------------------------------------------------------------
-- Riwayat revisi
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  (select count(*) from public.news_revisions where news_id = 'c0000000-0000-0000-0000-000000000001') >= 6,
  'setiap perubahan tercatat sebagai revisi');
select pg_temp.assert(
  (select edited_by from public.news_revisions where news_id = 'c0000000-0000-0000-0000-000000000001' and revision_no = 1)
    = '00000000-0000-0000-0000-0000000000a2',
  'revisi mencatat siapa yang mengubah');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a2', $q$select count(*) from public.news_revisions where news_id = 'c0000000-0000-0000-0000-000000000001'$q$) >= 6,
  'editor melihat riwayat revisi beritanya sendiri');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select count(*) from public.news_revisions') = 0,
  'editor lain tidak melihat riwayat revisi');
select pg_temp.assert(
  pg_temp.try_as('anon', null, 'select count(*) from public.news_revisions') like '42501%',
  'pengunjung tidak dapat membaca revisi');

-- ---------------------------------------------------------------------------
-- Kategori & tag
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.news_categories') = 4,
  'kategori dapat dibaca publik');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.news_categories (name, slug) values ('Liar', 'liar')$q$) like '42501%',
  'editor tidak dapat membuat kategori');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.news_categories (name, slug) values ('Ekstrakurikuler', 'ekstrakurikuler')$q$) = 'ok',
  'penerbit membuat kategori');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
    $q$insert into public.news_tags (id, name, slug) values ('d0000000-0000-0000-0000-000000000001', 'Lomba', 'lomba')$q$) = 'ok',
  'editor dapat membuat tag baru');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a4',
    $q$insert into public.news_tags (name, slug) values ('Spam', 'spam')$q$) like '42501%',
  'guru tanpa peran staf tidak dapat membuat tag');

-- Draf editor kedua dengan tag: tautan tidak terlihat publik.
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$insert into public.news (id, slug, title, author_id, status) values
     ('c0000000-0000-0000-0000-000000000002', 'draf-dua', 'Draf kedua', '00000000-0000-0000-0000-0000000000a3', 'draft')$q$) as hasil \gset
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a3',
    $q$insert into public.news_tag_links (news_id, tag_id) values ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001')$q$) = 'ok',
  'editor menandai drafnya dengan tag');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$delete from public.news_tag_links where news_id = 'c0000000-0000-0000-0000-000000000002'$q$) as hasil \gset
select pg_temp.assert((select count(*) from public.news_tag_links where news_id = 'c0000000-0000-0000-0000-000000000002') = 1,
  'editor lain tidak dapat menghapus tag pada draf orang lain');
select pg_temp.assert(
  pg_temp.count_as('anon', null, $q$select count(*) from public.news_tag_links where news_id = 'c0000000-0000-0000-0000-000000000002'$q$) = 0,
  'tag pada draf tidak terlihat publik');

-- Peran staf ikut gugur bila akun dinonaktifkan.
update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', $q$select count(*) from public.news where status <> 'published'$q$) = 0,
  'penerbit yang dinonaktifkan kehilangan akses CMS');

-- Bucket gambar tersedia dan publik untuk dibaca.
select pg_temp.assert(
  (select public and file_size_limit = 5242880 from storage.buckets where id = 'news-images'),
  'bucket gambar berita dibuat dengan batas ukuran 5 MB');

rollback;
\echo 'Pengujian CMS berita lulus.'
