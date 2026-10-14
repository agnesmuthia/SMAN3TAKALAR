-- =============================================================================
-- Fondasi: profil & peran, verifikasi guru/siswa, berita, pengaturan, audit.
--
-- Prinsip:
--   * Akun baru (email maupun Google) SELALU dibuat dengan role NULL dan
--     status 'pending'. Metadata OAuth tidak pernah dipakai untuk peran.
--   * Peran guru/siswa hanya diberikan admin setelah verifikasi.
--   * Peran guru_bk dan admin hanya dapat ditetapkan admin aktif.
--   * Pengguna tidak dapat mengubah kolom role/status miliknya sendiri.
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Supabase lama memberi hak tabel otomatis ke anon/authenticated. Kita
-- nonaktifkan untuk objek baru agar setiap hak akses ditulis eksplisit.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('guru', 'siswa', 'guru_bk', 'admin');
create type public.account_status as enum ('pending', 'active', 'disabled');
create type public.verification_status as enum ('submitted', 'approved', 'rejected');
create type public.news_status as enum ('draft', 'published', 'archived');
create type public.news_visibility as enum ('public', 'internal');

-- -----------------------------------------------------------------------------
-- Utilitas
-- -----------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profil
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Nama sesuai data sekolah yang diisi pengguna; dianggap resmi hanya setelah
  -- verified_at terisi. Nama profil Google TIDAK disalin ke sini.
  full_name text check (full_name is null or char_length(full_name) between 2 and 120),
  role public.user_role,
  status public.account_status not null default 'pending',
  profile_completed_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Akun aktif wajib punya peran.
  constraint profiles_active_needs_role check (status <> 'active' or role is not null)
);

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Profil dibuat otomatis untuk setiap pengguna baru auth.users, apa pun
-- penyedia loginnya. raw_user_meta_data sengaja diabaikan.
create function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Peran pengguna yang sedang login, hanya jika akunnya aktif.
create function public.current_active_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active';
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_active_role() = 'admin', false);
$$;

create function public.is_active_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.current_active_role() is not null;
$$;

-- -----------------------------------------------------------------------------
-- Pengaturan aplikasi (satu baris)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  -- Domain Google Workspace sekolah (opsional). Hanya SINYAL tambahan untuk
  -- admin saat verifikasi, bukan dasar penetapan peran.
  school_workspace_domain text check (
    school_workspace_domain is null or school_workspace_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
  ),
  -- off: tidak ada kiriman otomatis; draft: berita terbit membuat draf kampanye
  -- yang menunggu persetujuan; immediate: langsung dikirim (tidak disarankan
  -- untuk versi awal).
  newsletter_auto_mode text not null default 'off'
    check (newsletter_auto_mode in ('off', 'draft', 'immediate')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.app_settings (id) values (true);

create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Data induk sekolah (untuk pencocokan NIP/NIS). Hanya admin.
-- -----------------------------------------------------------------------------
create table public.school_roster (
  id uuid primary key default gen_random_uuid(),
  kind public.user_role not null check (kind in ('guru', 'siswa')),
  identifier text not null check (identifier ~ '^[0-9]{4,20}$'),
  full_name text not null,
  class_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, identifier)
);

-- -----------------------------------------------------------------------------
-- Permintaan verifikasi peran
-- -----------------------------------------------------------------------------
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  claimed_role public.user_role not null check (claimed_role in ('guru', 'siswa')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  -- NIP (guru) atau NIS/NISN (siswa). Hanya dapat dibaca pemilik & admin.
  identifier text not null check (identifier ~ '^[0-9]{4,20}$'),
  class_name text check (class_name is null or char_length(class_name) <= 40),
  -- Sinyal bantu untuk admin; keputusan tetap di tangan admin.
  roster_match boolean not null default false,
  email_domain_match boolean not null default false,
  status public.verification_status not null default 'submitted',
  reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 500),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index verification_requests_one_open
  on public.verification_requests (user_id) where status = 'submitted';

-- Pengguna pending mengajukan verifikasi. Satu permintaan terbuka per akun.
create function public.submit_verification_request(
  p_claimed_role public.user_role,
  p_full_name text,
  p_identifier text,
  p_class_name text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_status public.account_status;
  v_email text;
  v_domain text;
  v_roster boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_claimed_role not in ('guru', 'siswa') then
    raise exception 'role_not_requestable' using errcode = '22023';
  end if;

  select status into v_status from public.profiles where id = v_uid for update;
  if v_status is distinct from 'pending' then
    raise exception 'profile_not_pending' using errcode = '42501';
  end if;
  if exists (select 1 from public.verification_requests
             where user_id = v_uid and status = 'submitted') then
    raise exception 'request_already_open' using errcode = '23505';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  select s.school_workspace_domain into v_domain from public.app_settings s where s.id;

  select exists (
    select 1 from public.school_roster r
    where r.kind = p_claimed_role and r.identifier = btrim(p_identifier) and r.active
      and lower(regexp_replace(btrim(r.full_name), '\s+', ' ', 'g'))
        = lower(regexp_replace(btrim(p_full_name), '\s+', ' ', 'g'))
  ) into v_roster;

  insert into public.verification_requests
    (user_id, claimed_role, full_name, identifier, class_name, roster_match, email_domain_match)
  values (
    v_uid, p_claimed_role, btrim(p_full_name), btrim(p_identifier),
    nullif(btrim(coalesce(p_class_name, '')), ''),
    v_roster,
    v_domain is not null and v_email like ('%@' || v_domain)
  )
  returning id into v_id;

  update public.profiles
     set full_name = btrim(p_full_name), profile_completed_at = now()
   where id = v_uid;

  return v_id;
end;
$$;

-- Admin meninjau permintaan verifikasi.
create function public.admin_review_verification(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := auth.uid();
  v_req public.verification_requests;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_req from public.verification_requests
   where id = p_request_id and status = 'submitted' for update;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'approved'::public.verification_status
                       else 'rejected'::public.verification_status end,
         reviewer_note = p_note, reviewed_by = v_admin, reviewed_at = now()
   where id = p_request_id;

  if p_approve then
    update public.profiles
       set role = v_req.claimed_role, status = 'active',
           full_name = v_req.full_name, verified_at = now(), verified_by = v_admin
     where id = v_req.user_id and status = 'pending';
  end if;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (v_admin, case when p_approve then 'verification.approve' else 'verification.reject' end,
          'profile', v_req.user_id::text,
          jsonb_build_object('request_id', p_request_id, 'claimed_role', v_req.claimed_role));
end;
$$;

-- Admin menetapkan peran/status secara langsung (termasuk guru_bk & admin).
create function public.admin_set_user_access(
  p_user_id uuid,
  p_role public.user_role,
  p_status public.account_status
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := auth.uid();
  v_old public.profiles;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status = 'active' and p_role is null then
    raise exception 'active_needs_role' using errcode = '22023';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  -- Jangan sampai sekolah kehilangan admin aktif terakhir.
  if v_old.role = 'admin' and v_old.status = 'active'
     and (p_role is distinct from 'admin' or p_status <> 'active')
     and (select count(*) from public.profiles where role = 'admin' and status = 'active') <= 1 then
    raise exception 'last_admin' using errcode = '42501';
  end if;

  update public.profiles
     set role = p_role, status = p_status,
         verified_at = case when p_status = 'active' then coalesce(verified_at, now()) else verified_at end,
         verified_by = case when p_status = 'active' then coalesce(verified_by, v_admin) else verified_by end
   where id = p_user_id;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (v_admin, 'user.set_access', 'profile', p_user_id::text,
          jsonb_build_object('old_role', v_old.role, 'old_status', v_old.status,
                             'new_role', p_role, 'new_status', p_status));
end;
$$;

-- -----------------------------------------------------------------------------
-- Berita
-- -----------------------------------------------------------------------------
create table public.news (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(title) between 3 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  content text not null default '',
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  status public.news_status not null default 'draft',
  visibility public.news_visibility not null default 'public',
  -- Boleh dimasukkan ke buletin email (hanya berlaku bila publik & terbit).
  newsletter_eligible boolean not null default true,
  published_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_published_needs_date check (status <> 'published' or published_at is not null)
);
create index news_public_listing on public.news (published_at desc)
  where status = 'published' and visibility = 'public';

create trigger news_set_updated_at before update on public.news
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Log audit admin
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.school_roster enable row level security;
alter table public.verification_requests enable row level security;
alter table public.news enable row level security;
alter table public.admin_audit_log enable row level security;

-- profiles: pemilik membaca miliknya; admin membaca semua. Tidak ada UPDATE
-- langsung untuk role/status: hanya lewat fungsi admin di atas.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select to authenticated using (public.is_admin());

-- app_settings: hanya admin.
create policy app_settings_admin_select on public.app_settings
  for select to authenticated using (public.is_admin());
create policy app_settings_admin_update on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- school_roster: hanya admin.
create policy school_roster_admin_all on public.school_roster
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- verification_requests: pemilik membaca miliknya, admin membaca semua.
create policy verification_select_own on public.verification_requests
  for select to authenticated using (user_id = auth.uid());
create policy verification_select_admin on public.verification_requests
  for select to authenticated using (public.is_admin());

-- news: publik hanya melihat berita terbit & publik. Anggota aktif juga
-- melihat berita internal yang terbit. Admin mengelola semuanya.
create policy news_public_read on public.news
  for select to anon, authenticated
  using (status = 'published' and visibility = 'public' and published_at <= now());
create policy news_member_internal_read on public.news
  for select to authenticated
  using (status = 'published' and visibility = 'internal' and published_at <= now()
         and public.is_active_member());
create policy news_admin_all on public.news
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_audit_log: admin membaca. Penulisan lewat fungsi security definer
-- atau service role.
create policy audit_admin_select on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Hak akses (grant) eksplisit
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Cabut hak bawaan apa pun, lalu berikan hanya yang diperlukan. RLS tetap
-- menjadi penjaga utama baris data.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.news to anon, authenticated;
grant insert, update, delete on public.news to authenticated;
grant select on public.profiles to authenticated;
grant select, update on public.app_settings to authenticated;
grant select, insert, update, delete on public.school_roster to authenticated;
grant select on public.verification_requests to authenticated;
grant select on public.admin_audit_log to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_active_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_active_member() from public, anon;
revoke all on function public.submit_verification_request(public.user_role, text, text, text) from public, anon;
revoke all on function public.admin_review_verification(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_user_access(uuid, public.user_role, public.account_status) from public, anon;

grant execute on function public.current_active_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_member() to authenticated, service_role;
grant execute on function public.submit_verification_request(public.user_role, text, text, text) to authenticated;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_access(uuid, public.user_role, public.account_status) to authenticated;
