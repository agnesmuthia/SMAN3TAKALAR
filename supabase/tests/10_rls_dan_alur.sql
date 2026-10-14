-- Pengujian RLS, peran, dan alur langganan dengan data FIKTIF.
-- Dijalankan oleh scripts/test-db.sh setelah stub + migrasi diterapkan.
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

-- Menjalankan SQL sebagai peran tertentu dan mengembalikan kode error (atau
-- 'ok'). Dipakai untuk menguji penolakan akses.
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

-- ---------------------------------------------------------------------------
-- Akun baru (mis. dari Google) tidak pernah otomatis mendapat peran
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin.fiktif@contoh.sch.id', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'budi.fiktif@gmail.com',
   '{"role":"admin","full_name":"Nama Google Budi","nip":"123"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'siti.fiktif@contoh.sch.id', '{"role":"guru"}');

select pg_temp.assert(
  (select role is null and status = 'pending' and full_name is null
     from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'pengguna Google baru: role NULL, status pending, nama Google tidak disalin');

-- Admin pertama hanya bisa dibuat langsung di database oleh pemilik proyek.
update public.profiles set role = 'admin', status = 'active'
 where id = '00000000-0000-0000-0000-00000000000a';
update public.app_settings set school_workspace_domain = 'contoh.sch.id';

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$update public.profiles set role = 'admin', status = 'active'
       where id = '00000000-0000-0000-0000-0000000000b1'$q$) like '42501%',
  'pengguna tidak dapat mengubah role/status miliknya sendiri');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    'select count(*) from public.profiles') = 1,
  'pengguna biasa hanya melihat profilnya sendiri');

-- ---------------------------------------------------------------------------
-- Verifikasi peran
-- ---------------------------------------------------------------------------
insert into public.school_roster (kind, identifier, full_name)
values ('guru', '198001012005011001', 'Budi Santoso');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select public.submit_verification_request('admin', 'Budi Santoso', '198001012005011001')$q$)
    like '22023%',
  'peran admin tidak dapat diajukan sendiri');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select public.submit_verification_request('guru_bk', 'Budi Santoso', '198001012005011001')$q$)
    like '22023%',
  'peran guru_bk tidak dapat diajukan sendiri');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select public.submit_verification_request('guru', 'budi  santoso', '198001012005011001')$q$) = 'ok',
  'pengguna pending dapat mengajukan verifikasi guru');

select pg_temp.assert(
  (select roster_match and not email_domain_match from public.verification_requests
    where user_id = '00000000-0000-0000-0000-0000000000b1'),
  'pencocokan data induk tercatat; domain gmail bukan sinyal domain sekolah');

select pg_temp.assert(
  (select role is null and status = 'pending' from public.profiles
    where id = '00000000-0000-0000-0000-0000000000b1'),
  'mengajukan verifikasi tidak langsung memberi peran');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select public.submit_verification_request('guru', 'Budi Santoso', '198001012005011001')$q$) like '23505%',
  'hanya satu permintaan verifikasi terbuka per akun');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$select public.admin_review_verification(
         (select id from public.verification_requests limit 1), true)$q$) like '42501%',
  'non-admin tidak dapat menyetujui verifikasi');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    'select count(*) from public.verification_requests') = 0,
  'pengguna lain tidak dapat membaca NIP/NIS permintaan verifikasi orang lain');

-- ---------------------------------------------------------------------------
-- Berita: publik vs internal vs draf
-- ---------------------------------------------------------------------------
insert into public.news (id, slug, title, excerpt, content, status, visibility, published_at) values
  ('10000000-0000-0000-0000-000000000001', 'berita-publik', 'Berita Publik Fiktif', 'Ringkasan', 'Isi', 'published', 'public', now() - interval '1 hour'),
  ('10000000-0000-0000-0000-000000000002', 'berita-draf', 'Berita Draf Fiktif', 'Ringkasan', 'Isi', 'draft', 'public', null),
  ('10000000-0000-0000-0000-000000000003', 'berita-internal', 'Berita Internal Fiktif', 'Ringkasan', 'Isi', 'published', 'internal', now() - interval '1 hour'),
  ('10000000-0000-0000-0000-000000000004', 'berita-terjadwal', 'Berita Terjadwal Fiktif', 'Ringkasan', 'Isi', 'published', 'public', now() + interval '1 day');

select pg_temp.assert(
  pg_temp.count_as('anon', null, 'select count(*) from public.news') = 1,
  'pengunjung tanpa login hanya membaca berita publik yang sudah terbit');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select count(*) from public.news where visibility = 'internal'$q$) = 0,
  'akun pending tidak dapat membaca berita internal');

select pg_temp.assert(
  pg_temp.try_as('anon', null,
    $q$insert into public.news (slug, title) values ('spam', 'Spam berita')$q$) like '42501%',
  'pengunjung tidak dapat menulis berita');

-- Admin menyetujui -> menjadi guru aktif.
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.admin_review_verification(
         (select id from public.verification_requests
           where user_id = '00000000-0000-0000-0000-0000000000b1'), true, 'cocok data induk')$q$) = 'ok',
  'admin menyetujui verifikasi');

select pg_temp.assert(
  (select role = 'guru' and status = 'active' and full_name = 'budi  santoso'
     from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'setelah disetujui: guru aktif');

select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select count(*) from public.news where visibility = 'internal'$q$) = 1,
  'guru aktif dapat membaca berita internal');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select public.admin_set_user_access('00000000-0000-0000-0000-0000000000b1', 'admin', 'active')$q$)
    like '42501%',
  'guru tidak dapat mengangkat dirinya menjadi admin');

select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.admin_set_user_access('00000000-0000-0000-0000-00000000000a', 'guru', 'active')$q$)
    like '42501%',
  'admin aktif terakhir tidak dapat menurunkan dirinya');

-- Penonaktifan akun mencabut akses.
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.admin_set_user_access('00000000-0000-0000-0000-0000000000b1', 'guru', 'disabled')$q$) = 'ok',
  'admin menonaktifkan akun');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000b1',
    $q$select count(*) from public.news where visibility = 'internal'$q$) = 0,
  'akun nonaktif kehilangan akses berita internal');

-- ---------------------------------------------------------------------------
-- Langganan berita
-- ---------------------------------------------------------------------------
select pg_temp.assert(
  pg_temp.try_as('anon', null, 'select count(*) from public.newsletter_subscribers') like '42501%',
  'pengunjung tidak dapat membaca daftar pelanggan');
select pg_temp.assert(
  pg_temp.try_as('anon', null,
    $q$insert into public.newsletter_subscribers (email, consent_policy_version, consent_text)
       values ('x@contoh.test', 'v', 't')$q$) like '42501%',
  'pengunjung tidak dapat menulis langsung ke tabel pelanggan');
select pg_temp.assert(
  pg_temp.count_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    'select count(*) from public.newsletter_subscribers') = 0,
  'pengguna non-admin tidak melihat pelanggan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    'select count(*) from public.newsletter_confirmation_tokens') like '42501%',
  'token konfirmasi tidak dapat dibaca pengguna mana pun selain service role');

select pg_temp.assert(
  pg_temp.try_as('anon', null, $q$select public.newsletter_confirm(repeat('a', 64))$q$) like '42501%',
  'anon tidak dapat memanggil RPC konfirmasi langsung (hanya lewat server)');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.newsletter_enqueue_campaign(gen_random_uuid())$q$) like '42501%',
  'admin pun tidak dapat memanggil enqueue langsung dari browser (hanya service role)');
select pg_temp.assert(
  pg_temp.try_as('anon', null, $q$select public.check_rate_limit('x', 'y', 1, 1)$q$) like '42501%',
  'anon tidak dapat memanipulasi rate limit');
select pg_temp.assert(
  pg_temp.try_as('anon', null, 'select count(*) from public.profiles') like '42501%',
  'anon tidak dapat membaca profil');
select pg_temp.assert(
  pg_temp.try_as('anon', null, 'select count(*) from public.verification_requests') like '42501%',
  'anon tidak dapat membaca permintaan verifikasi (NIP/NIS)');

set local role service_role;

insert into public.newsletter_subscribers (id, email, consent_policy_version, consent_text, source) values
  ('20000000-0000-0000-0000-000000000001', 'Pembaca.Satu@Contoh.test', '2026-10-14', 'setuju', 'footer'),
  ('20000000-0000-0000-0000-000000000002', 'pembaca.dua@contoh.test', '2026-10-14', 'setuju', 'artikel');

insert into public.newsletter_confirmation_tokens (subscriber_id, token_hash, expires_at) values
  ('20000000-0000-0000-0000-000000000001', encode(extensions.digest('token-satu', 'sha256'), 'hex'), now() + interval '1 day'),
  ('20000000-0000-0000-0000-000000000002', encode(extensions.digest('token-kedaluwarsa', 'sha256'), 'hex'), now() - interval '1 minute');

select pg_temp.assert(public.newsletter_email_hash(' Pembaca.Satu@Contoh.test ')
  = encode(extensions.digest('pembaca.satu@contoh.test', 'sha256'), 'hex'),
  'hash email dinormalisasi (trim + huruf kecil)');

select pg_temp.assert(not public.newsletter_confirm(encode(extensions.digest('salah', 'sha256'), 'hex')),
  'token salah ditolak');
select pg_temp.assert(not public.newsletter_confirm(encode(extensions.digest('token-kedaluwarsa', 'sha256'), 'hex')),
  'token kedaluwarsa ditolak');
select pg_temp.assert(
  (select status = 'pending' from public.newsletter_subscribers where id = '20000000-0000-0000-0000-000000000002'),
  'langganan tidak aktif sebelum konfirmasi');
select pg_temp.assert(public.newsletter_confirm(encode(extensions.digest('token-satu', 'sha256'), 'hex')),
  'token valid mengaktifkan langganan');
select pg_temp.assert(not public.newsletter_confirm(encode(extensions.digest('token-satu', 'sha256'), 'hex')),
  'token hanya bisa dipakai sekali');

reset role;

-- Kampanye & aturan konten (sebagai admin).
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$insert into public.newsletter_campaigns (id, subject) values
       ('30000000-0000-0000-0000-000000000001', 'Buletin Fiktif')$q$) = 'ok',
  'admin membuat draf kampanye');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$insert into public.newsletter_campaign_items (campaign_id, news_id) values
       ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')$q$) like '42501%news_not_distributable%',
  'berita draf tidak dapat dimasukkan ke buletin');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$insert into public.newsletter_campaign_items (campaign_id, news_id) values
       ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003')$q$) like '42501%news_not_distributable%',
  'berita internal tidak dapat dimasukkan ke buletin');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$insert into public.newsletter_campaign_items (campaign_id, news_id) values
       ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004')$q$) like '42501%news_not_distributable%',
  'berita yang belum waktunya terbit tidak dapat dimasukkan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$insert into public.newsletter_campaign_items (campaign_id, news_id) values
       ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')$q$) = 'ok',
  'berita publik yang terbit dapat dimasukkan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$update public.newsletter_campaigns set status = 'approved'
       where id = '30000000-0000-0000-0000-000000000001'$q$) like '42501%',
  'persetujuan kampanye tidak bisa lewat UPDATE biasa (harus lewat server)');

set local role service_role;

select pg_temp.assert(
  pg_temp.try_as('service_role', null,
    $q$select public.newsletter_enqueue_campaign('30000000-0000-0000-0000-000000000001')$q$) like '42501%',
  'kampanye draf tidak dapat dikirim');

update public.newsletter_campaigns set status = 'approved', approved_at = now()
 where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.assert(public.newsletter_enqueue_campaign('30000000-0000-0000-0000-000000000001') = 1,
  'antrean hanya berisi pelanggan aktif (pending tidak ikut)');
select pg_temp.assert(public.newsletter_enqueue_campaign('30000000-0000-0000-0000-000000000001') = 0,
  'enqueue ulang tidak membuat duplikat');

select pg_temp.assert(
  (select count(*) from public.newsletter_claim_deliveries('30000000-0000-0000-0000-000000000001', 10, 3, 600)) = 1,
  'klaim pengiriman mengambil satu baris');
select pg_temp.assert(
  (select count(*) from public.newsletter_claim_deliveries('30000000-0000-0000-0000-000000000001', 10, 3, 600)) = 0,
  'baris yang sedang dikirim tidak diklaim dua kali');

-- Berhenti berlangganan.
select pg_temp.assert(not public.newsletter_unsubscribe('20000000-0000-0000-0000-000000000001', 99),
  'versi token berhenti berlangganan yang salah ditolak');
select pg_temp.assert(public.newsletter_unsubscribe('20000000-0000-0000-0000-000000000001', 1),
  'berhenti berlangganan berhasil');
select pg_temp.assert(public.newsletter_unsubscribe('20000000-0000-0000-0000-000000000001', 1),
  'berhenti berlangganan idempoten');
select pg_temp.assert(exists (select 1 from public.newsletter_suppression_records
   where email_hash = public.newsletter_email_hash('pembaca.satu@contoh.test') and reason = 'unsubscribed'),
  'alamat masuk daftar penolakan');

insert into public.newsletter_campaigns (id, subject, status, approved_at)
values ('30000000-0000-0000-0000-000000000002', 'Buletin Kedua Fiktif', 'approved', now());
select pg_temp.assert(public.newsletter_enqueue_campaign('30000000-0000-0000-0000-000000000002') = 0,
  'alamat yang berhenti berlangganan tidak menerima buletin berikutnya');

-- Data lama yang "aktif" tetapi ada di daftar penolakan tetap tidak dikirimi.
insert into public.newsletter_subscribers (id, email, status, confirmed_at, consent_policy_version, consent_text)
values ('20000000-0000-0000-0000-000000000003', 'bounce@contoh.test', 'active', now(), 'v', 't');
insert into public.newsletter_suppression_records (email_hash, reason)
values (public.newsletter_email_hash('bounce@contoh.test'), 'bounced');
select pg_temp.assert(public.newsletter_enqueue_campaign('30000000-0000-0000-0000-000000000002') = 0,
  'alamat bounce tidak dimasukkan antrean walau berstatus aktif');

insert into public.newsletter_confirmation_tokens (subscriber_id, token_hash, expires_at) values
  ('20000000-0000-0000-0000-000000000003', encode(extensions.digest('token-bounce', 'sha256'), 'hex'), now() + interval '1 day'),
  ('20000000-0000-0000-0000-000000000001', encode(extensions.digest('token-ulang', 'sha256'), 'hex'), now() + interval '1 day');
select pg_temp.assert(not public.newsletter_confirm(encode(extensions.digest('token-bounce', 'sha256'), 'hex')),
  'alamat bounce tidak dapat diaktifkan ulang lewat konfirmasi');
select pg_temp.assert(public.newsletter_confirm(encode(extensions.digest('token-ulang', 'sha256'), 'hex')),
  'pelanggan yang berhenti dapat berlangganan lagi lewat double opt-in');
select pg_temp.assert(not exists (select 1 from public.newsletter_suppression_records
   where email_hash = public.newsletter_email_hash('pembaca.satu@contoh.test')),
  'penolakan karena berhenti berlangganan dicabut setelah konfirmasi ulang');

-- Rate limit.
select pg_temp.assert(public.check_rate_limit('subscribe', 'abc', 2, 60), 'rate limit: permintaan 1 diizinkan');
select pg_temp.assert(public.check_rate_limit('subscribe', 'abc', 2, 60), 'rate limit: permintaan 2 diizinkan');
select pg_temp.assert(not public.check_rate_limit('subscribe', 'abc', 2, 60), 'rate limit: permintaan 3 ditolak');

reset role;

-- Anonimisasi oleh admin.
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-0000000000c1',
    $q$select public.newsletter_anonymize_subscriber('20000000-0000-0000-0000-000000000002')$q$) like '42501%',
  'non-admin tidak dapat menganonimkan pelanggan');
select pg_temp.assert(
  pg_temp.try_as('authenticated', '00000000-0000-0000-0000-00000000000a',
    $q$select public.newsletter_anonymize_subscriber('20000000-0000-0000-0000-000000000002')$q$) = 'ok',
  'admin menganonimkan pelanggan');
select pg_temp.assert(
  (select email is null and anonymized_at is not null from public.newsletter_subscribers
    where id = '20000000-0000-0000-0000-000000000002'),
  'email pelanggan dihapus setelah anonimisasi');
select pg_temp.assert(exists (select 1 from public.newsletter_suppression_records
   where email_hash = public.newsletter_email_hash('pembaca.dua@contoh.test')),
  'hash alamat yang dianonimkan tetap di daftar penolakan');

rollback;
\echo 'Semua pengujian database lulus.'
