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
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'guru1@contoh.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'guru2@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa-x1@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'siswa-x2@contoh.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'bk@contoh.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'pending@contoh.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'nonaktif@contoh.test');

update public.profiles set role = 'admin', status = 'active', full_name = 'Admin Contoh' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'guru', status = 'active', full_name = 'Guru Satu' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set role = 'guru', status = 'active', full_name = 'Guru Dua' where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set role = 'siswa', status = 'active', full_name = 'Siswa X1', class_name = 'X-1' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set role = 'siswa', status = 'active', full_name = 'Siswa X2', class_name = 'X-2' where id = '00000000-0000-0000-0000-0000000000b2';
update public.profiles set role = 'guru_bk', status = 'active', full_name = 'BK Contoh' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set role = 'siswa', status = 'disabled', class_name = 'X-1' where id = '00000000-0000-0000-0000-0000000000e1';

-- ---------------------------------------------------------------------------
-- Kelas siswa disalin saat verifikasi disetujui
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'baru@contoh.test');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000f1',
    $q$select public.submit_verification_request('siswa', 'Siswa Baru', '0099887766', 'XI-3')$q$) = 'ok',
  'siswa baru mengajukan verifikasi dengan kelas');
select pg_temp.assert(
  (select class_name is null from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  'kelas belum tercatat di profil sebelum disetujui');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.admin_review_verification(
         (select id from public.verification_requests where user_id = '00000000-0000-0000-0000-0000000000f1'), true)$q$) = 'ok',
  'admin menyetujui siswa baru');
select pg_temp.assert(
  (select class_name = 'XI-3' and role = 'siswa' from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'),
  'kelas disalin ke profil setelah disetujui');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select public.admin_set_student_class('00000000-0000-0000-0000-0000000000b1', 'XII-1')$q$) like '42501%',
  'siswa tidak dapat mengubah kelasnya sendiri lewat fungsi admin');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$update public.profiles set class_name = 'XII-1' where id = '00000000-0000-0000-0000-0000000000b1'$q$) like '42501%',
  'siswa tidak dapat mengubah kelas lewat UPDATE langsung');

-- ---------------------------------------------------------------------------
-- Pengumuman
-- ---------------------------------------------------------------------------
insert into public.announcements (id, title, audience, status, published_at) values
  ('a0000000-0000-0000-0000-000000000001', 'Untuk semua', 'semua', 'published', now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000002', 'Khusus guru', 'guru', 'published', now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000003', 'Khusus siswa', 'siswa', 'published', now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000004', 'Khusus BK', 'guru_bk', 'published', now() - interval '1 hour'),
  ('a0000000-0000-0000-0000-000000000005', 'Draf semua', 'semua', 'draft', null),
  ('a0000000-0000-0000-0000-000000000006', 'Terjadwal', 'semua', 'published', now() + interval '1 day');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select count(*) from public.announcements') = 2,
  'guru melihat pengumuman "semua" + "guru" saja');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.announcements') = 2,
  'siswa melihat pengumuman "semua" + "siswa" saja');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select count(*) from public.announcements') = 2,
  'BK melihat pengumuman "semua" + "guru_bk" saja');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000d1', 'select count(*) from public.announcements') = 0,
  'akun pending tidak melihat pengumuman internal');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000e1', 'select count(*) from public.announcements') = 0,
  'akun nonaktif tidak melihat pengumuman internal');
select pg_temp.assert(
  pg_temp.try_as('anon', null, 'select count(*) from public.announcements') like '42501%',
  'pengunjung tanpa login tidak dapat membaca pengumuman');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-00000000000a', 'select count(*) from public.announcements') = 6,
  'admin melihat semua pengumuman termasuk draf');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.announcements (title, status, published_at) values ('Palsu', 'published', now())$q$) like '42501%',
  'guru tidak dapat membuat pengumuman');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$insert into public.announcement_reads (announcement_id, user_id)
       values ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b1')$q$) = 'ok',
  'siswa menandai pengumuman siswa sebagai dibaca');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$insert into public.announcement_reads (announcement_id, user_id)
       values ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1')$q$) like '42501%',
  'siswa tidak dapat menandai pengumuman yang tidak dapat dilihatnya');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$insert into public.announcement_reads (announcement_id, user_id)
       values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2')$q$) like '42501%',
  'tidak dapat menandai dibaca atas nama pengguna lain');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b2', 'select count(*) from public.announcement_reads') = 0,
  'penanda dibaca pengguna lain tidak terlihat');

-- ---------------------------------------------------------------------------
-- Jadwal
-- ---------------------------------------------------------------------------
insert into public.schedule_entries (class_name, day_of_week, start_time, end_time, subject, teacher_id, room) values
  ('X-1', 1, '07:30', '09:00', 'Matematika', '00000000-0000-0000-0000-0000000000a1', 'R1'),
  ('X-1', 1, '09:15', '10:45', 'Fisika', '00000000-0000-0000-0000-0000000000a2', 'R2'),
  ('X-2', 1, '07:30', '09:00', 'Biologi', '00000000-0000-0000-0000-0000000000a2', 'R3');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.schedule_entries') = 2,
  'siswa X-1 hanya melihat jadwal kelasnya');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b2', 'select count(*) from public.schedule_entries') = 1,
  'siswa X-2 hanya melihat jadwal kelasnya');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select count(*) from public.schedule_entries') = 1,
  'guru hanya melihat jadwal mengajarnya sendiri');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a2', 'select count(*) from public.schedule_entries') = 2,
  'guru kedua melihat jadwal mengajarnya');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select count(*) from public.schedule_entries') = 0,
  'BK tidak melihat jadwal pelajaran');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000e1', 'select count(*) from public.schedule_entries') = 0,
  'siswa nonaktif tidak melihat jadwal');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.schedule_entries (class_name, day_of_week, start_time, end_time, subject)
       values ('X-1', 2, '07:00', '08:00', 'Palsu')$q$) like '42501%',
  'guru tidak dapat menambah jadwal');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$insert into public.schedule_entries (class_name, day_of_week, start_time, end_time, subject)
       values ('X-1', 2, '09:00', '08:00', 'Terbalik')$q$) like '23514%',
  'jam selesai harus setelah jam mulai');

-- ---------------------------------------------------------------------------
-- Tugas & materi
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.assignments (id, teacher_id, class_name, kind, title, link_url, published)
       values ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'X-1', 'tugas', 'Latihan Bab 1', 'https://contoh.test/materi', true)$q$) = 'ok',
  'guru membuat tugas terbit untuk X-1');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.assignments (id, teacher_id, class_name, kind, title, published)
       values ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'X-1', 'materi', 'Draf materi', false)$q$) = 'ok',
  'guru membuat materi draf');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.assignments (teacher_id, class_name, title, published)
       values ('00000000-0000-0000-0000-0000000000a2', 'X-1', 'Atas nama guru lain', true)$q$) like '42501%',
  'guru tidak dapat membuat tugas atas nama guru lain');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
    $q$insert into public.assignments (teacher_id, class_name, title, link_url)
       values ('00000000-0000-0000-0000-0000000000a1', 'X-1', 'Tautan berbahaya', 'javascript:alert(1)')$q$) like '23514%',
  'tautan tugas harus https');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$insert into public.assignments (teacher_id, class_name, title)
       values ('00000000-0000-0000-0000-0000000000b1', 'X-1', 'Siswa membuat tugas')$q$) like '42501%',
  'siswa tidak dapat membuat tugas');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.assignments') = 1,
  'siswa X-1 hanya melihat tugas TERBIT untuk kelasnya (draf tersembunyi)');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b2', 'select count(*) from public.assignments') = 0,
  'siswa kelas lain tidak melihat tugas X-1');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select count(*) from public.assignments') = 2,
  'guru pemilik melihat tugas terbit dan draf miliknya');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a2', 'select count(*) from public.assignments') = 0,
  'guru lain tidak melihat tugas guru pertama');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select count(*) from public.assignments') = 0,
  'BK tidak melihat tugas');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$delete from public.assignments where id = 'b0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'guru lain menjalankan DELETE tanpa error (RLS menyaring baris)');
select pg_temp.assert((select count(*) from public.assignments) = 2,
  'guru lain tidak dapat menghapus tugas milik guru pertama (0 baris terhapus)');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$update public.assignments set title = 'Dibajak' where id = 'b0000000-0000-0000-0000-000000000001'$q$) as hasil \gset
select pg_temp.assert((select title from public.assignments where id = 'b0000000-0000-0000-0000-000000000001') = 'Latihan Bab 1',
  'guru lain tidak dapat mengubah tugas milik guru pertama');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$update public.assignments set published = true where id = 'b0000000-0000-0000-0000-000000000002'$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'guru pemilik menjalankan UPDATE materinya');
select pg_temp.assert((select published from public.assignments where id = 'b0000000-0000-0000-0000-000000000002'),
  'guru pemilik menerbitkan materinya');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.assignments') = 2,
  'materi yang diterbitkan langsung terlihat siswa kelasnya');

-- Guru yang dinonaktifkan kehilangan akses ke tugasnya sendiri.
update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select count(*) from public.assignments') = 0,
  'guru nonaktif tidak dapat melihat tugasnya');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select count(*) from public.assignments') = 2,
  'tugas terbit tetap terlihat siswa walau gurunya nonaktif');

-- ---------------------------------------------------------------------------
-- Tidak ada jalur ke modul langganan/buletin
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name like 'newsletter\_%' escape '\'
       and column_name in ('announcement_id', 'assignment_id', 'schedule_id')
  ),
  'tabel buletin tidak merujuk pengumuman/tugas/jadwal');

rollback;
\echo 'Pengujian dashboard lulus.'
