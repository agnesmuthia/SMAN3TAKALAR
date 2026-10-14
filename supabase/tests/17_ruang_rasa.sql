-- Pengujian Ruang Rasa: isolasi akses, log, anonimitas, retensi (data FIKTIF; isi laporan = teks sandi tiruan).
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
  ('00000000-0000-0000-0000-0000000000a3', 'tu@contoh.test'),
  ('00000000-0000-0000-0000-0000000000bb', 'bk1@contoh.test'),
  ('00000000-0000-0000-0000-0000000000bc', 'bk2@contoh.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'siswa@contoh.test');
update public.profiles set role = 'admin', status = 'active', full_name = 'Admin Contoh' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'guru', status = 'active' where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3');
update public.profiles set role = 'guru_bk', status = 'active', full_name = 'BK Satu' where id = '00000000-0000-0000-0000-0000000000bb';
update public.profiles set role = 'guru_bk', status = 'active', full_name = 'BK Dua' where id = '00000000-0000-0000-0000-0000000000bc';
update public.profiles set role = 'siswa', status = 'active', class_name = 'X-1' where id = '00000000-0000-0000-0000-0000000000b1';
insert into public.staff_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin_website'),
  ('00000000-0000-0000-0000-0000000000a3', 'administrasi');

-- ---------------------------------------------------------------------------
-- Penugasan petugas
-- ---------------------------------------------------------------------------
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb',
  $q$select public.admin_set_rasa_handler('00000000-0000-0000-0000-0000000000bb', true)$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Guru BK tidak dapat menugaskan dirinya sendiri');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.admin_set_rasa_handler('00000000-0000-0000-0000-0000000000bb', true)$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Admin Website tidak dapat menugaskan petugas');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
  $q$select public.admin_set_rasa_handler('00000000-0000-0000-0000-0000000000b1', true)$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '22023%', 'hanya akun Guru BK aktif yang dapat ditugaskan (siswa ditolak)');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
  $q$select public.admin_set_rasa_handler('00000000-0000-0000-0000-0000000000bb', true)$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok'
  and exists (select 1 from public.admin_audit_log where action = 'rasa.handler_set' and target_id = '00000000-0000-0000-0000-0000000000bb'),
  'Super Admin menugaskan BK Satu dan tercatat di log');

-- ---------------------------------------------------------------------------
-- Pelapor (service role) mengirim laporan anonim
-- ---------------------------------------------------------------------------
select pg_temp.try_as('anon', null,
  $q$select public.rasa_submit('50000000-0000-4000-8000-000000000001', 'perundungan', false, 'v1.TEKS-SANDI-TIRUAN-CIPHERTEXT-LAPORAN', 'RSA-AB23-CD45', repeat('s', 32), repeat('h', 64))$q$) as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'pengunjung tidak dapat memanggil fungsi pengiriman langsung');
select pg_temp.try_as('service_role', null,
  $q$select public.rasa_submit('50000000-0000-4000-8000-000000000001', 'perundungan', false, 'v1.TEKS-SANDI-TIRUAN-CIPHERTEXT-LAPORAN', 'RSA-AB23-CD45', repeat('s', 32), repeat('h', 64))$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok', 'server menyimpan laporan anonim');
select pg_temp.assert(
  pg_temp.try_as('service_role', null,
    $q$select public.rasa_submit('50000000-0000-4000-8000-000000000002', 'siber', true, 'v1.TEKS-SANDI-TIRUAN-CIPHERTEXT-LAPORAN', 'RSA-IOL0-1111', repeat('s', 32), repeat('h', 64))$q$) like '23514%',
  'kode referensi memakai alfabet tanpa karakter membingungkan');
select pg_temp.assert(
  pg_temp.try_as('service_role', null,
    $q$select public.rasa_submit('50000000-0000-4000-8000-000000000003', 'siber', true, 'v1.TEKS-SANDI-TIRUAN-CIPHERTEXT-LAPORAN', 'RSA-AB23-CD45', repeat('s', 32), repeat('h', 64))$q$) like '23505%',
  'kode referensi unik');
select pg_temp.assert(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name in ('rasa_reports', 'rasa_messages')
                 and (column_name like '%ip%' and column_name not like '%ipt%' or column_name in ('user_id', 'reporter_id', 'email', 'created_by_user'))),
  'tidak ada kolom identitas/IP pelapor pada laporan');
select pg_temp.assert(
  pg_get_function_result('public.rasa_list_reports(public.rasa_status)'::regprocedure) not like '%pin%'
  and pg_get_function_result('public.rasa_reporter_view(uuid)'::regprocedure) = 'jsonb',
  'daftar petugas tidak memuat PIN');

-- ---------------------------------------------------------------------------
-- Siapa yang TIDAK dapat membaca
-- ---------------------------------------------------------------------------
select pg_temp.try_as('anon', null, 'select count(*) from public.rasa_reports') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'pengunjung tidak punya hak baca tabel laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a', 'select count(*) from public.rasa_reports') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Super Admin tidak dapat membaca tabel laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select count(*) from public.rasa_reports') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'petugas pun tidak membaca tabel langsung (harus lewat fungsi yang mencatat log)');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select count(*) from public.rasa_messages') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'pesan percakapan tidak dapat dibaca langsung');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select count(*) from public.rasa_access_log') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'log akses tidak dapat dibaca/diubah langsung');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select * from public.rasa_list_reports()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Admin Website tidak dapat melihat daftar laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a3', 'select * from public.rasa_list_reports()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Petugas Administrasi tidak dapat melihat daftar laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a', 'select * from public.rasa_get_report(''50000000-0000-4000-8000-000000000001'')') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Super Admin tidak dapat membuka isi laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bc', 'select * from public.rasa_list_reports()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'Guru BK yang belum ditugaskan tidak dapat melihat laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1', 'select * from public.rasa_get_report(''50000000-0000-4000-8000-000000000001'')') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'siswa tidak dapat membuka laporan');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select public.rasa_reporter_view(''50000000-0000-4000-8000-000000000001'')') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'fungsi sisi pelapor tidak dapat dipanggil pengguna login');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select * from public.rasa_reporter_credentials(''RSA-AB23-CD45'')') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'hash PIN tidak dapat diambil lewat sesi pengguna');

-- ---------------------------------------------------------------------------
-- Petugas yang ditugaskan
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select count(*) from public.rasa_list_reports()') = 1,
  'BK Satu melihat daftar laporan (tanpa isi)');
select pg_temp.assert(
  (select count(*) from public.rasa_access_log where action = 'buka') = 0,
  'melihat daftar tidak dicatat sebagai pembukaan laporan');
select pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select jsonb_array_length((public.rasa_get_report(''50000000-0000-4000-8000-000000000001'')) -> ''messages'')') as n \gset
select pg_temp.assert(
  (select count(*) from public.rasa_access_log where action = 'buka' and actor_id = '00000000-0000-0000-0000-0000000000bb'
     and report_id = '50000000-0000-4000-8000-000000000001') = 1,
  'setiap pembukaan laporan tercatat (siapa & kapan)');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb',
  $q$select public.rasa_reply('50000000-0000-4000-8000-000000000001', 'v1.BALASAN-SANDI-TIRUAN-DARI-PETUGAS')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok'
  and (select status from public.rasa_reports where id = '50000000-0000-4000-8000-000000000001') = 'diproses'
  and (select last_sender from public.rasa_reports where id = '50000000-0000-4000-8000-000000000001') = 'bk'
  and (select assigned_to from public.rasa_reports where id = '50000000-0000-4000-8000-000000000001') = '00000000-0000-0000-0000-0000000000bb',
  'balasan petugas mengubah status ke diproses dan menugaskan petugas');
select pg_temp.try_as('service_role', null,
  $q$select public.rasa_reporter_reply('50000000-0000-4000-8000-000000000001', 'v1.BALASAN-SANDI-TIRUAN-DARI-PELAPOR')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok'
  and (select last_sender from public.rasa_reports where id = '50000000-0000-4000-8000-000000000001') = 'pelapor'
  and jsonb_array_length(public.rasa_reporter_view('50000000-0000-4000-8000-000000000001') -> 'messages') = 2,
  'pelapor membalas; percakapan berisi dua pesan');
select pg_temp.assert(
  (public.rasa_reporter_view('50000000-0000-4000-8000-000000000001') ->> 'assigned_to') is null
  and (public.rasa_reporter_view('50000000-0000-4000-8000-000000000001') ->> 'reference_code') is null,
  'tampilan pelapor tidak membocorkan petugas/kode internal');

-- Status selesai & penutupan
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb',
  $q$select public.rasa_set_status('50000000-0000-4000-8000-000000000001', 'selesai')$q$) as hasil \gset
select pg_temp.assert(:'hasil' = 'ok'
  and (select closed_at is not null from public.rasa_reports where id = '50000000-0000-4000-8000-000000000001'),
  'petugas menyelesaikan laporan (closed_at terisi)');
select pg_temp.assert(
  pg_temp.try_as('service_role', null, $q$select public.rasa_reporter_reply('50000000-0000-4000-8000-000000000001', 'v1.BALASAN-SANDI-SETELAH-SELESAI')$q$) like '22023%'
  and pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', $q$select public.rasa_reply('50000000-0000-4000-8000-000000000001', 'v1.BALASAN-SANDI-SETELAH-SELESAI')$q$) like '22023%',
  'laporan selesai tidak menerima balasan baru');
select pg_temp.assert(
  pg_temp.try_as('service_role', null, $q$update public.rasa_reports set closed_at = null where id = '50000000-0000-4000-8000-000000000001'$q$) like '23514%',
  'status selesai wajib punya waktu penutupan');

-- ---------------------------------------------------------------------------
-- Super Admin: ringkasan tanpa isi laporan
-- ---------------------------------------------------------------------------
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000a1', 'select public.admin_rasa_overview()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'ringkasan hanya untuk Super Admin');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select public.admin_rasa_overview() as ov \gset
reset role;
reset request.jwt.claim.sub;
select pg_temp.assert(
  (:'ov'::jsonb -> 'counts' ->> 'selesai')::int = 1 and jsonb_array_length(:'ov'::jsonb -> 'handlers') = 1
  and jsonb_array_length(:'ov'::jsonb -> 'log') >= 3,
  'ringkasan Super Admin: jumlah per status, petugas, dan log akses');
select pg_temp.assert(
  :'ov' not like '%CIPHERTEXT%' and :'ov' not like '%SANDI%',
  'ringkasan Super Admin tidak memuat isi laporan atau pesan');

-- ---------------------------------------------------------------------------
-- Retensi
-- ---------------------------------------------------------------------------
insert into public.rasa_reports (id, reference_code, pin_salt, pin_hash, category, content, status, closed_at, created_at) values
  ('50000000-0000-4000-8000-0000000000a1', 'RSA-KAMA-2222', repeat('s', 32), repeat('h', 64), 'lainnya', 'v1.TEKS-SANDI-TIRUAN-LAPORAN-LAMA-SELESAI', 'selesai', now() - interval '13 months', now() - interval '14 months'),
  ('50000000-0000-4000-8000-0000000000a2', 'RSA-BARU-3333', repeat('s', 32), repeat('h', 64), 'lainnya', 'v1.TEKS-SANDI-TIRUAN-LAPORAN-BARU-SELESAI', 'selesai', now() - interval '5 months', now() - interval '6 months'),
  ('50000000-0000-4000-8000-0000000000a3', 'RSA-TUA9-4444', repeat('s', 32), repeat('h', 64), 'lainnya', 'v1.TEKS-SANDI-TIRUAN-LAPORAN-TUA-BELUM-SELESAI', 'diproses', null, now() - interval '20 months');
insert into public.rasa_messages (report_id, sender, content) values
  ('50000000-0000-4000-8000-0000000000a1', 'pelapor', 'v1.PESAN-SANDI-TIRUAN-UNTUK-LAPORAN-LAMA');
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a', 'select public.rasa_purge_expired()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'pembersihan hanya dapat dijalankan server');
select public.rasa_purge_expired() as dihapus \gset
select pg_temp.assert(
  :dihapus = 1
  and not exists (select 1 from public.rasa_reports where reference_code = 'RSA-KAMA-2222')
  and exists (select 1 from public.rasa_reports where reference_code = 'RSA-BARU-3333')
  and exists (select 1 from public.rasa_reports where reference_code = 'RSA-TUA9-4444'),
  'hanya laporan SELESAI yang melewati 12 bulan yang dihapus; yang terbuka tetap');
select pg_temp.assert(
  not exists (select 1 from public.rasa_messages where report_id = '50000000-0000-4000-8000-0000000000a1')
  and exists (select 1 from public.rasa_access_log where action = 'hapus_otomatis' and report_id = '50000000-0000-4000-8000-0000000000a1'),
  'pesan ikut terhapus; jejak penghapusan tetap tercatat tanpa isi');
update public.app_settings set rasa_retention_months = 3 where id;
select public.rasa_purge_expired() as dihapus2 \gset
select pg_temp.assert(:dihapus2 = 1 and not exists (select 1 from public.rasa_reports where reference_code = 'RSA-BARU-3333'),
  'masa simpan dapat diubah lewat pengaturan');
select pg_temp.assert(
  pg_temp.try_as('service_role', null, $q$update public.app_settings set rasa_retention_months = 1000$q$) like '23514%',
  'masa simpan dibatasi 3–60 bulan');

-- ---------------------------------------------------------------------------
-- Petugas dinonaktifkan kehilangan akses seketika
-- ---------------------------------------------------------------------------
update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000bb';
select pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000bb', 'select * from public.rasa_list_reports()') as hasil \gset
select pg_temp.assert(:'hasil' like '42501%', 'akun petugas yang dinonaktifkan langsung kehilangan akses');
select pg_temp.assert((select count(*) from public.rasa_handler_ids()) = 0,
  'petugas nonaktif tidak menerima notifikasi');

rollback;
\echo 'Pengujian Ruang Rasa lulus.'
