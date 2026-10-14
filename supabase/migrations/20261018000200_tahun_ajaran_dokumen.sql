-- =============================================================================
-- Tahap 5: tahun ajaran & semester, impor jadwal, arsip SK, perpustakaan digital.
--
-- Prinsip:
--   * Migrasi ADITIF: tidak menghapus tabel, kolom, data, atau policy lama.
--   * Pengelola data sekolah: Super Admin & Petugas Administrasi.
--   * Impor jadwal TIDAK PERNAH menimpa data: baris yang sudah ada dilewati
--     (ON CONFLICT DO NOTHING) dan setiap impor dapat dibatalkan per batch.
--   * File SK & PDF perpustakaan disimpan di bucket PRIVAT `documents`;
--     unduhan lewat tautan bertanda tangan setelah RLS memastikan hak baca.
--   * SK hanya dapat ditampilkan setelah dikonfirmasi diperiksa manusia.
-- =============================================================================

create function public.can_manage_school_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_staff_role('administrasi');
$$;

create function public.can_manage_library() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_publish_news() or public.has_staff_role('administrasi');
$$;

-- -----------------------------------------------------------------------------
-- Tahun ajaran & semester
-- -----------------------------------------------------------------------------
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (
    case when name ~ '^[0-9]{4}/[0-9]{4}$'
      then split_part(name, '/', 2)::int = split_part(name, '/', 1)::int + 1
      else false end
  ),
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_year_dates check (ends_on > starts_on)
);
create unique index academic_years_one_active on public.academic_years ((true)) where is_active;
create trigger academic_years_set_updated_at before update on public.academic_years
for each row execute function public.set_updated_at();

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  term smallint not null check (term in (1, 2)), -- 1 = Ganjil, 2 = Genap
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint semester_dates check (ends_on > starts_on),
  constraint semester_unique_term unique (academic_year_id, term)
);
create unique index semesters_one_active on public.semesters ((true)) where is_active;
create trigger semesters_set_updated_at before update on public.semesters
for each row execute function public.set_updated_at();

create function public.active_semester_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.semesters where is_active limit 1;
$$;

-- Daftar guru aktif (hanya id & nama) untuk pengelola jadwal. Petugas
-- Administrasi tidak diberi akses baca penuh ke tabel profiles.
create function public.list_active_teachers() returns table (id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_manage_school_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name from public.profiles p
     where p.role = 'guru' and p.status = 'active' and p.full_name is not null
     order by p.full_name;
end;
$$;

-- Mengaktifkan satu semester (dan tahun ajarannya) secara atomik.
create function public.set_active_semester(p_semester uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_year uuid;
begin
  if not public.can_manage_school_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select academic_year_id into v_year from public.semesters where id = p_semester;
  if v_year is null then
    raise exception 'semester_not_found' using errcode = 'P0002';
  end if;
  update public.semesters set is_active = false where is_active and id <> p_semester;
  update public.academic_years set is_active = false where is_active and id <> v_year;
  update public.academic_years set is_active = true where id = v_year and not is_active;
  update public.semesters set is_active = true where id = p_semester and not is_active;
end;
$$;

-- -----------------------------------------------------------------------------
-- Jadwal: kaitan ke semester + batch impor (kolom baru, data lama tetap)
-- -----------------------------------------------------------------------------
create type public.import_status as enum ('pratinjau', 'selesai', 'dibatalkan');

create table public.schedule_import_batches (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 200),
  status public.import_status not null default 'pratinjau',
  total_rows integer not null default 0 check (total_rows between 0 and 2000),
  valid_count integer not null default 0,
  existing_count integer not null default 0,
  error_count integer not null default 0,
  inserted_count integer,
  -- Baris valid yang siap dimasukkan (hasil validasi server).
  valid_rows jsonb not null default '[]'::jsonb check (jsonb_typeof(valid_rows) = 'array'),
  -- Laporan per baris untuk ditampilkan ke petugas.
  report jsonb not null default '[]'::jsonb check (jsonb_typeof(report) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  committed_by uuid references public.profiles (id) on delete set null,
  committed_at timestamptz,
  reverted_by uuid references public.profiles (id) on delete set null,
  reverted_at timestamptz
);
create index schedule_import_batches_recent on public.schedule_import_batches (created_at desc);

alter table public.schedule_entries
  add column semester_id uuid references public.semesters (id) on delete restrict,
  add column import_batch_id uuid references public.schedule_import_batches (id) on delete set null;
-- Satu kelas tidak boleh punya dua sesi yang mulai di jam yang sama dalam satu
-- semester. Jadwal lama (semester_id NULL) tidak terpengaruh (NULL selalu berbeda).
alter table public.schedule_entries
  add constraint schedule_unique_slot unique (semester_id, class_name, day_of_week, start_time);
create index schedule_by_semester on public.schedule_entries (semester_id, class_name, day_of_week);

-- Memasukkan baris valid sebuah pratinjau. Baris yang sudah ada dilewati.
create function public.commit_schedule_import(p_batch uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_batch public.schedule_import_batches%rowtype;
  v_inserted integer;
begin
  if not public.can_manage_school_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_batch from public.schedule_import_batches where id = p_batch for update;
  if not found or v_batch.status <> 'pratinjau' then
    raise exception 'batch_not_pending' using errcode = '22023';
  end if;
  insert into public.schedule_entries
    (semester_id, class_name, day_of_week, start_time, end_time, subject, teacher_id, room, import_batch_id)
  select v_batch.semester_id, r.class_name, r.day_of_week, r.start_time, r.end_time, r.subject, r.teacher_id, r.room, p_batch
    from jsonb_to_recordset(v_batch.valid_rows)
      as r(class_name text, day_of_week smallint, start_time time, end_time time, subject text, teacher_id uuid, room text)
  on conflict (semester_id, class_name, day_of_week, start_time) do nothing;
  get diagnostics v_inserted = row_count;
  update public.schedule_import_batches
     set status = 'selesai', inserted_count = v_inserted, committed_at = now(), committed_by = auth.uid()
   where id = p_batch;
  return v_inserted;
end;
$$;

-- Membatalkan satu impor: hanya menghapus baris yang berasal dari batch itu.
create function public.revert_schedule_import(p_batch uuid) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_status public.import_status;
  v_deleted integer;
begin
  if not public.can_manage_school_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_status from public.schedule_import_batches where id = p_batch for update;
  if v_status is distinct from 'selesai' then
    raise exception 'batch_not_committed' using errcode = '22023';
  end if;
  delete from public.schedule_entries where import_batch_id = p_batch;
  get diagnostics v_deleted = row_count;
  update public.schedule_import_batches
     set status = 'dibatalkan', reverted_at = now(), reverted_by = auth.uid()
   where id = p_batch;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Arsip SK (Surat Keputusan)
-- -----------------------------------------------------------------------------
create type public.decree_status as enum ('berlaku', 'arsip');

create table public.decrees (
  id uuid primary key default gen_random_uuid(),
  number text not null check (char_length(number) between 1 and 120),
  title text not null check (char_length(title) between 3 and 300),
  issued_on date not null,
  issuer text check (issuer is null or char_length(issuer) <= 150),
  academic_year_id uuid references public.academic_years (id) on delete set null,
  status public.decree_status not null default 'berlaku',
  visibility public.news_visibility not null default 'internal',
  file_path text not null check (file_path ~ '^sk/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.pdf$'),
  file_size integer not null check (file_size between 1 and 10485760),
  is_published boolean not null default false,
  -- Petugas memastikan isi PDF sesuai metadata dan boleh dibagikan.
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decree_unique_number unique (number, issued_on),
  constraint decree_publish_needs_verification check (not is_published or verified_at is not null)
);
create index decrees_listing on public.decrees (issued_on desc) where is_published;
create trigger decrees_set_updated_at before update on public.decrees
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Perpustakaan digital
-- -----------------------------------------------------------------------------
create type public.library_kind as enum ('tautan', 'pdf');

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  author text check (author is null or char_length(author) <= 200),
  category text not null default 'Umum' check (char_length(category) between 1 and 60),
  description text not null default '' check (char_length(description) <= 1000),
  kind public.library_kind not null,
  url text check (url is null or (url ~ '^https://' and char_length(url) <= 1000)),
  file_path text check (file_path is null or file_path ~ '^perpustakaan/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}\.pdf$'),
  file_size integer check (file_size is null or file_size between 1 and 10485760),
  cover_image_url text check (cover_image_url is null or cover_image_url ~ '^https://'),
  visibility public.news_visibility not null default 'public',
  is_published boolean not null default false,
  -- PDF yang diunggah wajib dikonfirmasi boleh didistribusikan sekolah.
  rights_confirmed_by uuid references public.profiles (id) on delete set null,
  rights_confirmed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_source check (
    (kind = 'tautan' and url is not null and file_path is null)
    or (kind = 'pdf' and file_path is not null and url is null)
  ),
  constraint library_pdf_needs_rights check (kind <> 'pdf' or not is_published or rights_confirmed_at is not null)
);
create index library_items_listing on public.library_items (category, title) where is_published;
create trigger library_items_set_updated_at before update on public.library_items
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.academic_years enable row level security;
alter table public.semesters enable row level security;
alter table public.schedule_import_batches enable row level security;
alter table public.decrees enable row level security;
alter table public.library_items enable row level security;

create policy academic_years_read on public.academic_years for select to anon, authenticated using (true);
create policy academic_years_manager_all on public.academic_years
  for all to authenticated using (public.can_manage_school_admin()) with check (public.can_manage_school_admin());

create policy semesters_read on public.semesters for select to anon, authenticated using (true);
create policy semesters_manager_all on public.semesters
  for all to authenticated using (public.can_manage_school_admin()) with check (public.can_manage_school_admin());

create policy import_batches_manager_all on public.schedule_import_batches
  for all to authenticated using (public.can_manage_school_admin()) with check (public.can_manage_school_admin());

-- Jadwal: Petugas Administrasi ikut mengelola (policy admin lama tetap).
create policy schedule_administrasi_all on public.schedule_entries
  for all to authenticated using (public.has_staff_role('administrasi')) with check (public.has_staff_role('administrasi'));

create policy decrees_public_read on public.decrees
  for select to anon, authenticated using (is_published and visibility = 'public');
create policy decrees_member_read on public.decrees
  for select to authenticated using (is_published and visibility = 'internal' and public.is_active_member());
create policy decrees_manager_all on public.decrees
  for all to authenticated using (public.can_manage_school_admin()) with check (public.can_manage_school_admin());

create policy library_public_read on public.library_items
  for select to anon, authenticated using (is_published and visibility = 'public');
create policy library_member_read on public.library_items
  for select to authenticated using (is_published and visibility = 'internal' and public.is_active_member());
create policy library_manager_all on public.library_items
  for all to authenticated using (public.can_manage_library()) with check (public.can_manage_library());

-- -----------------------------------------------------------------------------
-- Hak akses eksplisit
-- -----------------------------------------------------------------------------
revoke all on public.academic_years, public.semesters, public.schedule_import_batches,
  public.decrees, public.library_items from anon, authenticated;
grant select on public.academic_years, public.semesters, public.decrees, public.library_items to anon, authenticated;
grant insert, update, delete on public.academic_years, public.semesters, public.decrees, public.library_items to authenticated;
grant select, insert, update, delete on public.schedule_import_batches to authenticated;
grant all on public.academic_years, public.semesters, public.schedule_import_batches,
  public.decrees, public.library_items to service_role;

revoke all on function public.can_manage_school_admin() from public, anon;
revoke all on function public.can_manage_library() from public, anon;
revoke all on function public.active_semester_id() from public;
revoke all on function public.list_active_teachers() from public, anon;
revoke all on function public.set_active_semester(uuid) from public, anon;
revoke all on function public.commit_schedule_import(uuid) from public, anon;
revoke all on function public.revert_schedule_import(uuid) from public, anon;
grant execute on function public.can_manage_school_admin() to authenticated, service_role;
grant execute on function public.can_manage_library() to authenticated, service_role;
grant execute on function public.active_semester_id() to anon, authenticated, service_role;
grant execute on function public.list_active_teachers() to authenticated;
grant execute on function public.set_active_semester(uuid) to authenticated;
grant execute on function public.commit_schedule_import(uuid) to authenticated;
grant execute on function public.revert_schedule_import(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Bucket PRIVAT untuk SK & PDF perpustakaan. Tidak ada policy baca/tulis untuk
-- browser: server memeriksa hak baca (RLS tabel) lalu membuat tautan sementara.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
