-- Pengujian Tahap 6 (log aktivitas otomatis, status sistem, pembersihan) dengan data FIKTIF.
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
  ('00000000-0000-0000-0000-0000000000a1', 'adminweb@contoh.test');
update public.profiles set role = 'admin', status = 'active', full_name = 'Admin Contoh' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'guru', status = 'active'
 where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');
insert into public.staff_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'administrasi'),
  ('00000000-0000-0000-0000-0000000000a1', 'admin_website');

-- ---------------------------------------------------------------------------
-- Log aktivitas otomatis
-- ---------------------------------------------------------------------------
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$insert into public.decrees (id, number, title, issued_on, file_path, file_size) values
     ('40000000-0000-4000-8000-000000000001', '421/100/SMA', 'SK Contoh Log', '2026-07-13',
      'sk/2026/07/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 1000)$q$) as hasil \gset
select pg_temp.assert(
  (select count(*) from public.admin_audit_log
    where action = 'decrees.insert' and actor_id = '00000000-0000-0000-0000-0000000000c1'
      and target_id = '40000000-0000-4000-8000-000000000001' and details ->> 'label' = 'SK Contoh Log') = 1,
  'menambah SK tercatat di log beserta pelakunya');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$update public.decrees set status = 'arsip' where id = '40000000-0000-4000-8000-000000000001'$q$) as hasil \gset
select pg_temp.assert(
  (select details -> 'changed' from public.admin_audit_log where action = 'decrees.update' order by id desc limit 1) = '["status"]'::jsonb,
  'perubahan mencatat NAMA kolom yang berubah saja');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
  $q$update public.decrees set status = 'arsip' where id = '40000000-0000-4000-8000-000000000001'$q$) as hasil \gset
select pg_temp.assert(
  (select count(*) from public.admin_audit_log where action = 'decrees.update') = 1,
  'pembaruan tanpa perubahan nilai tidak dicatat');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$insert into public.site_pages (id, slug, title, content_html) values
     ('40000000-0000-4000-8000-000000000002', 'uji-log', 'Halaman Uji Log', '<p>RAHASIA-ISI</p>')$q$) as hasil \gset
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$delete from public.site_pages where id = '40000000-0000-4000-8000-000000000002'$q$) as hasil \gset
select pg_temp.assert(
  (select count(*) from public.admin_audit_log where action = 'site_pages.delete' and details ->> 'label' = 'Halaman Uji Log') = 1
  and not exists (select 1 from public.admin_audit_log where details::text like '%RAHASIA-ISI%'),
  'penghapusan halaman tercatat tanpa menyalin isi konten');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select count(*) from public.admin_audit_log') = 0,
  'log aktivitas hanya dapat dibaca Super Admin');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$delete from public.admin_audit_log$q$) like '42501%',
  'log aktivitas tidak dapat dihapus dari aplikasi');

-- ---------------------------------------------------------------------------
-- Status sistem
-- ---------------------------------------------------------------------------
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1', 'select public.admin_system_status()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'status sistem hanya untuk Super Admin');
select pg_temp.assert(
  pg_temp.try_as('anon', null, 'select public.admin_system_status()') like '42501%',
  'pengunjung tidak dapat memanggil status sistem');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.admin_system_status() as status \gset
reset request.jwt.claim.sub;
select pg_temp.assert(
  (:'status'::jsonb -> 'tables_without_rls') = '[]'::jsonb,
  'semua tabel public memakai RLS');
select pg_temp.assert(
  (:'status'::jsonb -> 'counts' ->> 'decrees')::int = 1 and (:'status'::jsonb ->> 'admins_active')::int = 1,
  'status sistem menghitung data');
select pg_temp.assert(
  (select bool_and((b ->> 'public')::boolean = (b ->> 'id' <> 'documents')) from jsonb_array_elements(:'status'::jsonb -> 'buckets') b),
  'status sistem melaporkan bucket (documents privat, lainnya publik)');

-- ---------------------------------------------------------------------------
-- Pembersihan pratinjau impor
-- ---------------------------------------------------------------------------
insert into public.academic_years (id, name, starts_on, ends_on) values ('50000000-0000-4000-8000-000000000001', '2026/2027', '2026-07-13', '2027-06-30');
insert into public.semesters (id, academic_year_id, term, starts_on, ends_on) values
  ('50000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 1, '2026-07-13', '2026-12-19');
insert into public.schedule_import_batches (semester_id, file_name, status, created_at) values
  ('50000000-0000-4000-8000-000000000002', 'lama.csv', 'pratinjau', now() - interval '8 days'),
  ('50000000-0000-4000-8000-000000000002', 'baru.csv', 'pratinjau', now()),
  ('50000000-0000-4000-8000-000000000002', 'selesai.csv', 'selesai', now() - interval '30 days');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a', 'select public.school_purge_stale()') like '42501%',
  'pembersihan hanya dapat dijalankan server (service role)');
select public.school_purge_stale() as purge \gset
select pg_temp.assert(
  (:'purge'::jsonb ->> 'import_previews')::int = 1
  and (select array_agg(file_name order by file_name) from public.schedule_import_batches) = array['baru.csv', 'selesai.csv'],
  'hanya pratinjau terbengkalai > 7 hari yang dibersihkan; riwayat impor tetap');

rollback;
\echo 'Pengujian operasional lulus.'
