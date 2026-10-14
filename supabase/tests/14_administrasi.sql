-- Pengujian Tahap 5 (tahun ajaran, impor jadwal, arsip SK, perpustakaan) dengan data FIKTIF.
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
  ('00000000-0000-0000-0000-0000000000c1', 'tu@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'adminweb@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa@contoh.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'guru@contoh.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'pending@contoh.test');
update public.profiles set role = 'admin', status = 'active' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'guru', status = 'active'
 where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
              '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1');
update public.profiles set role = 'siswa', status = 'active', class_name = 'X-1' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.staff_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'administrasi'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin_website'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor');

-- ---------------------------------------------------------------------------
-- Tahun ajaran & semester
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.academic_years (name, starts_on, ends_on) values ('2026/2028', '2026-07-13', '2027-06-30')$q$) like '23514%',
  'nama tahun ajaran harus berurutan (YYYY/YYYY+1)');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$insert into public.academic_years (name, starts_on, ends_on) values ('2026/2027', '2026-07-13', '2027-06-30')$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Admin Website tidak dapat membuat tahun ajaran');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$insert into public.academic_years (id, name, starts_on, ends_on) values
     ('10000000-0000-4000-8000-000000000001', '2026/2027', '2026-07-13', '2027-06-30')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'Petugas Administrasi membuat tahun ajaran');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$insert into public.semesters (id, academic_year_id, term, starts_on, ends_on) values
     ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, '2026-07-13', '2026-12-19'),
     ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 2, '2027-01-04', '2027-06-30')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'Petugas Administrasi membuat semester ganjil & genap');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.semesters (academic_year_id, term, starts_on, ends_on) values
       ('10000000-0000-4000-8000-000000000001', 1, '2026-07-13', '2026-12-19')$q$) like '23505%',
  'semester yang sama tidak dapat dibuat dua kali');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
  $q$select public.set_active_semester('20000000-0000-4000-8000-000000000001')$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'siswa tidak dapat mengaktifkan semester');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$select public.set_active_semester('20000000-0000-4000-8000-000000000001')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok' and public.active_semester_id() = '20000000-0000-4000-8000-000000000001',
  'Petugas Administrasi mengaktifkan semester ganjil');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$select public.set_active_semester('20000000-0000-4000-8000-000000000002')$q$) as hasil \gset
select pg_temp.assert(
  (select count(*) from public.semesters where is_active) = 1
  and public.active_semester_id() = '20000000-0000-4000-8000-000000000002'
  and (select is_active from public.academic_years where id = '10000000-0000-4000-8000-000000000001'),
  'hanya satu semester aktif; tahun ajarannya ikut aktif');
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.semesters') = 2,
  'daftar semester dapat dibaca publik');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$select public.set_active_semester('20000000-0000-4000-8000-000000000001')$q$) as hasil \gset

update public.profiles set full_name = 'Guru Contoh' where id = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select count(*) from public.list_active_teachers()') = 1
  and pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select count(*) from public.profiles') = 1,
  'Petugas Administrasi melihat daftar guru (id & nama) tanpa akses penuh ke profil');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select * from public.list_active_teachers()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'siswa tidak dapat membaca daftar guru');

-- ---------------------------------------------------------------------------
-- Impor jadwal
-- ---------------------------------------------------------------------------
insert into public.schedule_entries (semester_id, class_name, day_of_week, start_time, end_time, subject)
values ('20000000-0000-4000-8000-000000000001', 'X-1', 1, '07:30', '09:00', 'Matematika (data lama)');

select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$insert into public.schedule_import_batches (id, semester_id, file_name, total_rows, valid_count, valid_rows) values
     ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'jadwal.csv', 2, 2,
      '[{"class_name":"X-1","day_of_week":1,"start_time":"07:30","end_time":"09:00","subject":"Fisika (impor)","teacher_id":null,"room":null},
        {"class_name":"X-1","day_of_week":1,"start_time":"09:15","end_time":"10:45","subject":"Biologi","teacher_id":"00000000-0000-0000-0000-0000000000e1","room":"Lab"}]')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'Petugas Administrasi menyimpan pratinjau impor');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.schedule_import_batches') = 0,
  'siswa tidak dapat melihat batch impor');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$select public.commit_schedule_import('30000000-0000-4000-8000-000000000001')$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'editor berita tidak dapat menjalankan impor');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$select public.commit_schedule_import('30000000-0000-4000-8000-000000000001')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'impor dijalankan');
select pg_temp.assert(
  (select inserted_count from public.schedule_import_batches where id = '30000000-0000-4000-8000-000000000001') = 1
  and (select subject from public.schedule_entries where class_name = 'X-1' and day_of_week = 1 and start_time = '07:30') = 'Matematika (data lama)',
  'impor tidak menimpa jadwal yang sudah ada (hanya 1 baris baru)');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$select public.commit_schedule_import('30000000-0000-4000-8000-000000000001')$q$) like '22023%',
  'batch yang sama tidak dapat diimpor dua kali');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.schedule_entries') = 2,
  'siswa melihat jadwal kelasnya (data lama + hasil impor)');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$select public.revert_schedule_import('30000000-0000-4000-8000-000000000001')$q$) as hasil \gset
select pg_temp.assert(
  :'hasil' = 'ok'
  and (select count(*) from public.schedule_entries) = 1
  and (select status from public.schedule_import_batches where id = '30000000-0000-4000-8000-000000000001') = 'dibatalkan',
  'membatalkan impor hanya menghapus baris dari batch tersebut');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.schedule_entries (semester_id, class_name, day_of_week, start_time, end_time, subject)
       values ('20000000-0000-4000-8000-000000000001', 'X-1', 1, '07:30', '08:15', 'Ganda')$q$) like '23505%',
  'slot kelas yang sama dalam satu semester ditolak database');
insert into public.schedule_entries (class_name, day_of_week, start_time, end_time, subject) values
  ('XI-2', 2, '07:30', '09:00', 'Jadwal lama A'), ('XI-2', 2, '07:30', '09:00', 'Jadwal lama B');
select pg_temp.assert((select count(*) from public.schedule_entries where semester_id is null) = 2,
  'jadwal lama tanpa semester tidak terpengaruh aturan baru');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$delete from public.semesters where id = '20000000-0000-4000-8000-000000000001'$q$) like '23503%',
  'semester yang masih punya jadwal tidak dapat dihapus');

-- ---------------------------------------------------------------------------
-- Arsip SK
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.decrees (number, title, issued_on, file_path, file_size, is_published) values
       ('421/001/SMA', 'SK Pembagian Tugas', '2026-07-13', 'sk/2026/07/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 1000, true)$q$) like '23514%',
  'SK tidak dapat ditampilkan sebelum diperiksa');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$insert into public.decrees (number, title, issued_on, file_path, file_size) values
     ('421/002/SMA', 'SK Uji', '2026-07-13', 'sk/2026/07/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf', 1000)$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Admin Website tidak dapat mengelola arsip SK');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.decrees (number, title, issued_on, file_path, file_size) values
       ('421/003/SMA', 'SK Path', '2026-07-13', '../rahasia.pdf', 1000)$q$) like '23514%',
  'lokasi file SK harus sesuai pola aman');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$insert into public.decrees (number, title, issued_on, file_path, file_size, visibility, is_published, verified_at, verified_by) values
     ('421/010/SMA', 'SK Internal', '2026-07-13', 'sk/2026/07/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf', 1000, 'internal', true, now(), '00000000-0000-0000-0000-0000000000c1'),
     ('421/011/SMA', 'SK Publik', '2026-07-14', 'sk/2026/07/dddddddd-dddd-4ddd-8ddd-dddddddddddd.pdf', 1000, 'public', true, now(), '00000000-0000-0000-0000-0000000000c1'),
     ('421/012/SMA', 'SK Draf', '2026-07-15', 'sk/2026/07/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.pdf', 1000, 'public', false, null, null)$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'Petugas Administrasi menyimpan SK');
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.decrees') = 1,
  'pengunjung hanya melihat SK publik yang ditampilkan');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.decrees') = 2,
  'warga sekolah aktif juga melihat SK internal');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000d1', 'select count(*) from public.decrees') = 1,
  'akun pending tidak melihat SK internal');

-- ---------------------------------------------------------------------------
-- Perpustakaan
-- ---------------------------------------------------------------------------
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$insert into public.library_items (title, kind, url, is_published) values ('Portal contoh', 'tautan', 'https://contoh.test/buku', true)$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'Admin Website menambah tautan perpustakaan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$insert into public.library_items (title, kind, url) values ('Editor', 'tautan', 'https://contoh.test/x')$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'editor berita tidak dapat mengelola perpustakaan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.library_items (title, kind, file_path, file_size, is_published) values
       ('Modul PDF', 'pdf', 'perpustakaan/2026/10/ffffffff-ffff-4fff-8fff-ffffffffffff.pdf', 1000, true)$q$) like '23514%',
  'PDF perpustakaan wajib konfirmasi hak distribusi sebelum ditampilkan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$insert into public.library_items (title, kind, url) values ('Tautan tidak aman', 'tautan', 'http://contoh.test')$q$) like '23514%',
  'tautan perpustakaan wajib https');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$insert into public.library_items (title, kind, file_path, file_size, is_published, visibility, rights_confirmed_at) values
     ('Modul internal', 'pdf', 'perpustakaan/2026/10/abababab-abab-4bab-8bab-abababababab.pdf', 1000, true, 'internal', now())$q$) as hasil \gset
select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.library_items') = 1
  and pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.library_items') = 2,
  'koleksi internal hanya untuk warga sekolah aktif');

select pg_temp.assert(
  (select not public from storage.buckets where id = 'documents'),
  'bucket dokumen bersifat privat');

rollback;
\echo 'Pengujian administrasi sekolah lulus.'
