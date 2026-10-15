-- =============================================================================
-- Ruang Rasa: pelaporan perundungan/kekerasan yang aman untuk siswa.
--
-- Keputusan sekolah yang diterapkan:
--   * Pelapor boleh ANONIM (tanpa login). Identitas pelapor TIDAK disimpan:
--     tidak ada kolom user, tidak ada alamat IP. Pelapor mendapat kode
--     referensi + PIN rahasia (PIN disimpan sebagai hash).
--   * Hanya Guru BK yang DITUGASKAN Super Admin yang dapat membaca laporan.
--     Super Admin, Admin Website, Editor, dan Petugas Administrasi tidak
--     punya jalur baca (tidak ada hak tabel, tidak ada policy).
--   * Setiap pembukaan laporan dicatat (siapa, kapan) tanpa isi laporan.
--   * Laporan selesai dihapus otomatis setelah masa simpan
--     (app_settings.rasa_retention_months, bawaan 12 bulan).
--   * Isi laporan & pesan dienkripsi AES-256-GCM di aplikasi sebelum masuk
--     database; database (dan backup) hanya menyimpan teks sandi. Kunci ada di
--     environment hosting (RASA_ENCRYPTION_KEY), bukan di database.
--
-- Isolasi: tidak ada relasi ke berita, buletin, jadwal, tugas, atau galeri.
-- Seluruh akses lewat fungsi SECURITY DEFINER; tabel tidak diberi hak apa pun
-- untuk anon/authenticated sehingga pembacaan tak dapat melewati pencatatan.
-- Migrasi aditif.
-- =============================================================================

create type public.rasa_status as enum ('baru', 'diproses', 'selesai');
create type public.rasa_category as enum
  ('perundungan', 'kekerasan_fisik', 'kekerasan_verbal', 'pelecehan', 'siber', 'lainnya');
create type public.rasa_sender as enum ('pelapor', 'bk');

alter table public.app_settings
  add column rasa_retention_months integer not null default 12
    check (rasa_retention_months between 3 and 60),
  -- Catatan prosedur darurat sekolah yang ditampilkan di formulir (ditulis sekolah).
  add column rasa_notice text check (rasa_notice is null or char_length(rasa_notice) <= 1000);

-- -----------------------------------------------------------------------------
-- Petugas Ruang Rasa (Guru BK yang ditugaskan)
-- -----------------------------------------------------------------------------
create table public.rasa_handlers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Laporan & percakapan (isi = teks sandi dari aplikasi)
-- -----------------------------------------------------------------------------
create table public.rasa_reports (
  id uuid primary key,
  reference_code text not null unique check (reference_code ~ '^RSA-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$'),
  pin_salt text not null check (char_length(pin_salt) between 16 and 128),
  pin_hash text not null check (char_length(pin_hash) between 32 and 256),
  category public.rasa_category not null,
  urgent boolean not null default false,
  status public.rasa_status not null default 'baru',
  content text not null check (char_length(content) between 20 and 40000),
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  last_sender public.rasa_sender,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint rasa_closed_consistency check ((status = 'selesai') = (closed_at is not null))
);
create index rasa_reports_open on public.rasa_reports (status, urgent desc, created_at desc);
create trigger rasa_reports_set_updated_at before update on public.rasa_reports
for each row execute function public.set_updated_at();

create table public.rasa_messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.rasa_reports (id) on delete cascade,
  sender public.rasa_sender not null,
  content text not null check (char_length(content) between 20 and 20000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index rasa_messages_by_report on public.rasa_messages (report_id, created_at);

-- Log akses: siapa membuka/membalas/mengubah, tanpa isi. report_id sengaja
-- tanpa foreign key agar jejak tetap ada setelah laporan dihapus otomatis.
create table public.rasa_access_log (
  id bigint generated always as identity primary key,
  report_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 40),
  created_at timestamptz not null default now()
);
create index rasa_access_log_recent on public.rasa_access_log (created_at desc);

alter table public.rasa_handlers enable row level security;
alter table public.rasa_reports enable row level security;
alter table public.rasa_messages enable row level security;
alter table public.rasa_access_log enable row level security;
-- Sengaja TANPA policy dan tanpa hak tabel: semua akses lewat fungsi di bawah.

revoke all on public.rasa_handlers, public.rasa_reports, public.rasa_messages, public.rasa_access_log
  from public, anon, authenticated;
grant all on public.rasa_handlers, public.rasa_reports, public.rasa_messages, public.rasa_access_log to service_role;
revoke all on sequence public.rasa_access_log_id_seq from public, anon, authenticated;
grant all on sequence public.rasa_access_log_id_seq to service_role;

-- -----------------------------------------------------------------------------
-- Pemeriksaan petugas
-- -----------------------------------------------------------------------------
create function public.rasa_is_handler() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.rasa_handlers h
      join public.profiles p on p.id = h.user_id
     where h.user_id = auth.uid() and p.role = 'guru_bk' and p.status = 'active'
  );
$$;

-- -----------------------------------------------------------------------------
-- Fungsi petugas (Guru BK yang ditugaskan)
-- -----------------------------------------------------------------------------

-- Daftar tanpa isi laporan (tidak dicatat di log akses).
create function public.rasa_list_reports(p_status public.rasa_status default null)
returns table (
  id uuid,
  reference_code text,
  category public.rasa_category,
  urgent boolean,
  status public.rasa_status,
  created_at timestamptz,
  last_message_at timestamptz,
  last_sender public.rasa_sender,
  assigned_name text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.rasa_is_handler() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select r.id, r.reference_code, r.category, r.urgent, r.status, r.created_at,
           r.last_message_at, r.last_sender, p.full_name
      from public.rasa_reports r
      left join public.profiles p on p.id = r.assigned_to
     where p_status is null or r.status = p_status
     order by (r.status <> 'selesai') desc, r.urgent desc, coalesce(r.last_message_at, r.created_at) desc
     limit 500;
end;
$$;

-- Membuka satu laporan: dicatat di log akses.
create function public.rasa_get_report(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_report jsonb;
begin
  if not public.rasa_is_handler() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'id', r.id, 'reference_code', r.reference_code, 'category', r.category, 'urgent', r.urgent,
           'status', r.status, 'created_at', r.created_at, 'closed_at', r.closed_at,
           'assigned_to', r.assigned_to, 'content', r.content,
           'messages', coalesce((
             select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'content', m.content,
                                                 'created_at', m.created_at) order by m.created_at, m.id)
               from public.rasa_messages m where m.report_id = r.id), '[]'::jsonb))
    into v_report
    from public.rasa_reports r
   where r.id = p_id;
  if v_report is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.rasa_access_log (report_id, actor_id, action) values (p_id, auth.uid(), 'buka');
  return v_report;
end;
$$;

create function public.rasa_reply(p_id uuid, p_content text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_status public.rasa_status;
begin
  if not public.rasa_is_handler() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select status into v_status from public.rasa_reports where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status = 'selesai' then
    raise exception 'report_closed' using errcode = '22023';
  end if;
  insert into public.rasa_messages (report_id, sender, content, created_by)
  values (p_id, 'bk', p_content, auth.uid());
  update public.rasa_reports
     set last_message_at = now(), last_sender = 'bk',
         status = case when status = 'baru' then 'diproses'::public.rasa_status else status end,
         assigned_to = coalesce(assigned_to, auth.uid())
   where id = p_id;
  insert into public.rasa_access_log (report_id, actor_id, action) values (p_id, auth.uid(), 'balas');
end;
$$;

create function public.rasa_set_status(p_id uuid, p_status public.rasa_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.rasa_is_handler() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.rasa_reports
     set status = p_status,
         closed_at = case when p_status = 'selesai' then now() else null end,
         assigned_to = case when p_status = 'baru' then assigned_to else coalesce(assigned_to, auth.uid()) end
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.rasa_access_log (report_id, actor_id, action)
  values (p_id, auth.uid(), 'status:' || p_status::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi Super Admin: menugaskan petugas, ringkasan TANPA isi laporan
-- -----------------------------------------------------------------------------
create function public.admin_set_rasa_handler(p_user_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_enabled then
    if not exists (select 1 from public.profiles where id = p_user_id and role = 'guru_bk' and status = 'active') then
      raise exception 'not_active_bk' using errcode = '22023';
    end if;
    insert into public.rasa_handlers (user_id, assigned_by) values (p_user_id, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from public.rasa_handlers where user_id = p_user_id;
  end if;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'rasa.handler_set', 'profile', p_user_id::text, jsonb_build_object('enabled', p_enabled));
end;
$$;

create function public.admin_rasa_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'counts', jsonb_build_object(
      'baru', (select count(*) from public.rasa_reports where status = 'baru'),
      'diproses', (select count(*) from public.rasa_reports where status = 'diproses'),
      'selesai', (select count(*) from public.rasa_reports where status = 'selesai'),
      'mendesak_terbuka', (select count(*) from public.rasa_reports where urgent and status <> 'selesai')),
    'handlers', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', h.user_id, 'full_name', p.full_name,
                                          'assigned_at', h.assigned_at,
                                          'active', (p.role = 'guru_bk' and p.status = 'active'))
                       order by p.full_name)
        from public.rasa_handlers h join public.profiles p on p.id = h.user_id), '[]'::jsonb),
    'log', coalesce((
      select jsonb_agg(x order by x.id desc) from (
        select l.id, l.created_at, l.action, r.reference_code, p.full_name as actor_name
          from public.rasa_access_log l
          left join public.rasa_reports r on r.id = l.report_id
          left join public.profiles p on p.id = l.actor_id
         order by l.id desc limit 100) x), '[]'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi server (service role): pelapor tanpa login & pembersihan
-- -----------------------------------------------------------------------------
create function public.rasa_submit(
  p_id uuid, p_category public.rasa_category, p_urgent boolean, p_content text,
  p_code text, p_salt text, p_hash text
) returns void
language sql security definer set search_path = '' as $$
  insert into public.rasa_reports (id, reference_code, pin_salt, pin_hash, category, urgent, content)
  values (p_id, p_code, p_salt, p_hash, p_category, p_urgent, p_content);
$$;

create function public.rasa_reporter_credentials(p_code text)
returns table (id uuid, pin_salt text, pin_hash text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.pin_salt, r.pin_hash from public.rasa_reports r where r.reference_code = p_code;
$$;

create function public.rasa_reporter_view(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'status', r.status, 'category', r.category, 'urgent', r.urgent,
           'created_at', r.created_at, 'closed_at', r.closed_at,
           'messages', coalesce((
             select jsonb_agg(jsonb_build_object('id', m.id, 'sender', m.sender, 'content', m.content,
                                                 'created_at', m.created_at) order by m.created_at, m.id)
               from public.rasa_messages m where m.report_id = r.id), '[]'::jsonb))
    from public.rasa_reports r where r.id = p_id;
$$;

create function public.rasa_reporter_reply(p_id uuid, p_content text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_status public.rasa_status;
begin
  select status into v_status from public.rasa_reports where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status = 'selesai' then
    raise exception 'report_closed' using errcode = '22023';
  end if;
  if (select count(*) from public.rasa_messages where report_id = p_id) >= 60 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;
  insert into public.rasa_messages (report_id, sender, content) values (p_id, 'pelapor', p_content);
  update public.rasa_reports set last_message_at = now(), last_sender = 'pelapor' where id = p_id;
end;
$$;

create function public.rasa_handler_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select h.user_id from public.rasa_handlers h
    join public.profiles p on p.id = h.user_id
   where p.role = 'guru_bk' and p.status = 'active';
$$;

create function public.rasa_purge_expired() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_months integer;
  v_deleted integer;
begin
  select coalesce(rasa_retention_months, 12) into v_months from public.app_settings where id;
  with gone as (
    select id from public.rasa_reports
     where status = 'selesai' and closed_at < now() - make_interval(months => coalesce(v_months, 12))
  ), logged as (
    insert into public.rasa_access_log (report_id, actor_id, action)
    select id, null, 'hapus_otomatis' from gone returning 1
  ), del as (
    delete from public.rasa_reports r using gone where r.id = gone.id returning 1
  )
  select count(*) into v_deleted from del;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hak eksekusi eksplisit
-- -----------------------------------------------------------------------------
revoke all on function public.rasa_is_handler() from public, anon, authenticated;
revoke all on function public.rasa_list_reports(public.rasa_status) from public, anon, authenticated;
revoke all on function public.rasa_get_report(uuid) from public, anon, authenticated;
revoke all on function public.rasa_reply(uuid, text) from public, anon, authenticated;
revoke all on function public.rasa_set_status(uuid, public.rasa_status) from public, anon, authenticated;
revoke all on function public.admin_set_rasa_handler(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_rasa_overview() from public, anon, authenticated;
revoke all on function public.rasa_submit(uuid, public.rasa_category, boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function public.rasa_reporter_credentials(text) from public, anon, authenticated;
revoke all on function public.rasa_reporter_view(uuid) from public, anon, authenticated;
revoke all on function public.rasa_reporter_reply(uuid, text) from public, anon, authenticated;
revoke all on function public.rasa_handler_ids() from public, anon, authenticated;
revoke all on function public.rasa_purge_expired() from public, anon, authenticated;

grant execute on function public.rasa_is_handler() to authenticated, service_role;
grant execute on function public.rasa_list_reports(public.rasa_status) to authenticated;
grant execute on function public.rasa_get_report(uuid) to authenticated;
grant execute on function public.rasa_reply(uuid, text) to authenticated;
grant execute on function public.rasa_set_status(uuid, public.rasa_status) to authenticated;
grant execute on function public.admin_set_rasa_handler(uuid, boolean) to authenticated;
grant execute on function public.admin_rasa_overview() to authenticated;
grant execute on function public.rasa_submit(uuid, public.rasa_category, boolean, text, text, text, text) to service_role;
grant execute on function public.rasa_reporter_credentials(text) to service_role;
grant execute on function public.rasa_reporter_view(uuid) to service_role;
grant execute on function public.rasa_reporter_reply(uuid, text) to service_role;
grant execute on function public.rasa_handler_ids() to service_role;
grant execute on function public.rasa_purge_expired() to service_role;
