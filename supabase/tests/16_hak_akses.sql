-- Audit hak akses database (Tahap 7). Gagal bila migrasi baru tanpa sengaja
-- membuka tabel/fungsi untuk pengunjung (anon). Bila perubahan disengaja,
-- tinjau risikonya lalu perbarui daftar izin di bawah.
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

-- Pengunjung hanya boleh MEMBACA tabel konten publik (baris tetap disaring RLS).
select pg_temp.assert(
  (select coalesce(array_agg(distinct table_name::text order by table_name::text), '{}')
     from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public')
  = array['academic_years', 'achievements', 'announcements', 'calendar_events', 'decrees', 'gallery_albums',
          'gallery_photos', 'library_items', 'news', 'news_categories', 'news_tag_links', 'news_tags',
          'school_programs', 'semesters', 'site_pages', 'site_profile'],
  'anon hanya dapat mengakses tabel konten publik yang disetujui');
select pg_temp.assert(
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'anon' and table_schema = 'public' and privilege_type <> 'SELECT'),
  'anon tidak punya hak tulis pada tabel mana pun');
select pg_temp.assert(
  not exists (select 1 from information_schema.role_table_grants
               where grantee in ('anon', 'authenticated') and table_schema = 'public'
                 and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')),
  'anon/authenticated tidak punya hak TRUNCATE/REFERENCES/TRIGGER');
select pg_temp.assert(
  not exists (select 1 from information_schema.role_table_grants
               where grantee in ('anon', 'authenticated') and table_schema = 'public'
                 and table_name in ('newsletter_subscribers', 'newsletter_confirmation_tokens',
                                    'newsletter_suppression_records', 'rate_limit_hits', 'newsletter_deliveries')
                 and privilege_type in ('INSERT', 'UPDATE', 'DELETE')),
  'data langganan tidak dapat ditulis langsung dari browser');
-- Data induk NIP/NIS boleh dikelola Super Admin; semua policy-nya wajib is_admin().
select pg_temp.assert(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'school_roster') > 0
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'school_roster'
                   and (coalesce(qual, '') not like '%is_admin()%' or (with_check is not null and with_check not like '%is_admin()%'))),
  'data induk NIP/NIS hanya dapat diakses Super Admin (policy is_admin)');

-- Fungsi yang dapat dipanggil pengunjung.
select pg_temp.assert(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE'))
  = array['active_semester_id'],
  'anon hanya dapat memanggil fungsi yang disetujui');
select pg_temp.assert(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.prosecdef
                 and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'semua fungsi SECURITY DEFINER menetapkan search_path');
select pg_temp.assert(
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.prosecdef
                 and p.proname in ('audit_content_change', 'news_workflow_guard', 'news_record_revision', 'handle_new_auth_user')
                 and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'fungsi trigger internal tidak dapat dipanggil langsung oleh pengguna');

-- RLS & bucket.
select pg_temp.assert(
  not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  'RLS aktif di semua tabel public');
select pg_temp.assert(
  (select public from storage.buckets where id = 'documents') = false,
  'bucket dokumen tetap privat');

\echo 'Audit hak akses lulus.'
