-- =============================================================================
-- Dashboard guru / siswa / BK: pengumuman internal, jadwal pelajaran, tugas &
-- materi.
--
-- Prinsip:
--   * Hanya akun AKTIF dengan peran yang sesuai yang dapat membaca.
--   * Pengumuman & jadwal dikelola admin; tugas/materi dikelola guru pemiliknya.
--   * Tidak ada tabel di sini yang berhubungan dengan modul berita/buletin
--     email maupun data konseling (Ruang Rasa).
--   * Tugas & materi hanya berisi teks dan tautan https (belum ada unggah file).
-- =============================================================================

-- Kelas siswa disalin dari permintaan verifikasi saat admin menyetujui.
alter table public.profiles
  add column class_name text check (class_name is null or char_length(class_name) <= 40);

create or replace function public.admin_review_verification(
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
           full_name = v_req.full_name, verified_at = now(), verified_by = v_admin,
           class_name = case when v_req.claimed_role = 'siswa' then v_req.class_name else null end
     where id = v_req.user_id and status = 'pending';
  end if;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (v_admin, case when p_approve then 'verification.approve' else 'verification.reject' end,
          'profile', v_req.user_id::text,
          jsonb_build_object('request_id', p_request_id, 'claimed_role', v_req.claimed_role));
end;
$$;

-- Admin mengubah kelas siswa (mis. kenaikan kelas).
create function public.admin_set_student_class(p_user_id uuid, p_class_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles
     set class_name = nullif(btrim(coalesce(p_class_name, '')), '')
   where id = p_user_id and role = 'siswa';
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'user.set_class', 'profile', p_user_id::text,
          jsonb_build_object('class_name', nullif(btrim(coalesce(p_class_name, '')), '')));
end;
$$;

-- Kelas milik siswa aktif yang sedang login.
create function public.current_student_class() returns text
language sql stable security definer set search_path = '' as $$
  select p.class_name from public.profiles p
  where p.id = auth.uid() and p.status = 'active' and p.role = 'siswa';
$$;

-- -----------------------------------------------------------------------------
-- Pengumuman internal
-- -----------------------------------------------------------------------------
create type public.announcement_audience as enum ('semua', 'guru', 'siswa', 'guru_bk');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  audience public.announcement_audience not null default 'semua',
  status public.news_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_published_needs_date check (status <> 'published' or published_at is not null)
);
create index announcements_listing on public.announcements (published_at desc) where status = 'published';
create trigger announcements_set_updated_at before update on public.announcements
for each row execute function public.set_updated_at();

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Jadwal pelajaran
-- -----------------------------------------------------------------------------
create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  class_name text not null check (char_length(class_name) between 1 and 40),
  day_of_week smallint not null check (day_of_week between 1 and 6), -- 1 = Senin ... 6 = Sabtu
  start_time time not null,
  end_time time not null,
  subject text not null check (char_length(subject) between 1 and 100),
  teacher_id uuid references public.profiles (id) on delete set null,
  room text check (room is null or char_length(room) <= 40),
  created_at timestamptz not null default now(),
  constraint schedule_time_order check (end_time > start_time)
);
create index schedule_by_class on public.schedule_entries (class_name, day_of_week, start_time);
create index schedule_by_teacher on public.schedule_entries (teacher_id, day_of_week, start_time);

-- -----------------------------------------------------------------------------
-- Tugas & materi (teks + tautan https)
-- -----------------------------------------------------------------------------
create type public.assignment_kind as enum ('tugas', 'materi');

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  class_name text not null check (char_length(class_name) between 1 and 40),
  kind public.assignment_kind not null default 'tugas',
  title text not null check (char_length(title) between 3 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  link_url text check (link_url is null or (link_url ~ '^https://' and char_length(link_url) <= 1000)),
  due_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_by_class on public.assignments (class_name, created_at desc) where published;
create index assignments_by_teacher on public.assignments (teacher_id, created_at desc);
create trigger assignments_set_updated_at before update on public.assignments
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.assignments enable row level security;

-- Pengumuman: anggota aktif membaca yang terbit & ditujukan ke perannya.
create policy announcements_member_read on public.announcements
  for select to authenticated
  using (
    status = 'published' and published_at <= now()
    and public.is_active_member()
    and (audience = 'semua' or audience::text = public.current_active_role()::text)
  );
create policy announcements_admin_all on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Penanda dibaca: milik sendiri, dan hanya untuk pengumuman yang boleh dibacanya.
create policy announcement_reads_own_select on public.announcement_reads
  for select to authenticated using (user_id = auth.uid());
create policy announcement_reads_own_insert on public.announcement_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_active_member()
    and exists (select 1 from public.announcements a where a.id = announcement_id)
  );
create policy announcement_reads_own_delete on public.announcement_reads
  for delete to authenticated using (user_id = auth.uid());

-- Jadwal: siswa melihat kelasnya, guru melihat jadwal mengajarnya, admin semua.
create policy schedule_student_read on public.schedule_entries
  for select to authenticated
  using (class_name = public.current_student_class());
create policy schedule_teacher_read on public.schedule_entries
  for select to authenticated
  using (teacher_id = auth.uid() and public.current_active_role() = 'guru');
create policy schedule_admin_all on public.schedule_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tugas & materi: guru mengelola miliknya; siswa membaca yang terbit untuk kelasnya.
create policy assignments_teacher_select on public.assignments
  for select to authenticated
  using (teacher_id = auth.uid() and public.current_active_role() = 'guru');
create policy assignments_teacher_insert on public.assignments
  for insert to authenticated
  with check (teacher_id = auth.uid() and public.current_active_role() = 'guru');
create policy assignments_teacher_update on public.assignments
  for update to authenticated
  using (teacher_id = auth.uid() and public.current_active_role() = 'guru')
  with check (teacher_id = auth.uid() and public.current_active_role() = 'guru');
create policy assignments_teacher_delete on public.assignments
  for delete to authenticated
  using (teacher_id = auth.uid() and public.current_active_role() = 'guru');
create policy assignments_student_read on public.assignments
  for select to authenticated
  using (published and class_name = public.current_student_class());
create policy assignments_admin_all on public.assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Hak akses eksplisit
-- -----------------------------------------------------------------------------
revoke all on public.announcements, public.announcement_reads, public.schedule_entries,
  public.assignments from anon, authenticated;

grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, delete on public.announcement_reads to authenticated;
grant select, insert, update, delete on public.schedule_entries to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant all on public.announcements, public.announcement_reads, public.schedule_entries,
  public.assignments to service_role;

revoke all on function public.admin_set_student_class(uuid, text) from public, anon;
revoke all on function public.current_student_class() from public, anon;
grant execute on function public.admin_set_student_class(uuid, text) to authenticated;
grant execute on function public.current_student_class() to authenticated, service_role;
