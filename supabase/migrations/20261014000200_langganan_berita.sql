-- =============================================================================
-- Langganan berita melalui email (double opt-in).
--
-- Prinsip:
--   * Pelanggan tidak perlu akun website. Tabel ini terpisah dari profiles;
--     akun guru/siswa TIDAK otomatis didaftarkan.
--   * Token konfirmasi disimpan sebagai hash SHA-256, punya masa berlaku, dan
--     sekali pakai. Token berhenti berlangganan berbentuk HMAC (tidak
--     disimpan); versi token dapat dinaikkan untuk membatalkan token lama.
--   * Daftar penolakan (suppression) menyimpan hash email sehingga alamat
--     yang berhenti/bounce tidak terkirim lagi meski datanya dianonimkan.
--   * Hanya berita TERBIT + PUBLIK + newsletter_eligible yang bisa masuk
--     kampanye; diperiksa trigger DB dan diperiksa ulang saat pengiriman.
--   * Tidak ada tabel atau kolom yang merujuk data konseling/Ruang Rasa.
-- =============================================================================

create type public.subscriber_status as enum ('pending', 'active', 'unsubscribed');
create type public.campaign_status as enum
  ('draft', 'approved', 'sending', 'sent', 'partially_failed', 'failed', 'cancelled');
create type public.delivery_status as enum
  ('queued', 'sending', 'sent', 'failed', 'bounced', 'complained', 'skipped');
create type public.suppression_reason as enum ('unsubscribed', 'bounced', 'complained', 'manual');

-- Hash email yang sama persis dengan src/lib/newsletter/email.ts (sha256 hex
-- dari email yang sudah di-trim dan di-lowercase).
create function public.newsletter_email_hash(p_email text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(convert_to(lower(btrim(p_email)), 'UTF8'), 'sha256'), 'hex');
$$;

-- -----------------------------------------------------------------------------
-- Pelanggan
-- -----------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  -- NULL setelah dianonimkan.
  email extensions.citext unique check (email is null or char_length(email::text) <= 254),
  status public.subscriber_status not null default 'pending',
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  anonymized_at timestamptz,
  source text check (source is null or source in ('footer', 'halaman_berita', 'artikel', 'beranda')),
  -- Bukti persetujuan: versi kebijakan privasi & teks persetujuan saat itu.
  consent_policy_version text not null,
  consent_text text not null,
  consent_at timestamptz not null default now(),
  -- Naikkan untuk membatalkan semua token berhenti berlangganan yang lama.
  unsubscribe_token_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriber_active_needs_confirm check (status <> 'active' or confirmed_at is not null),
  constraint subscriber_anonymized_no_email check (anonymized_at is null or email is null)
);
create index newsletter_subscribers_status on public.newsletter_subscribers (status);

create trigger newsletter_subscribers_set_updated_at before update on public.newsletter_subscribers
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Token konfirmasi (hanya hash yang disimpan)
-- -----------------------------------------------------------------------------
create table public.newsletter_confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.newsletter_subscribers (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index newsletter_tokens_subscriber on public.newsletter_confirmation_tokens (subscriber_id);

-- -----------------------------------------------------------------------------
-- Daftar penolakan
-- -----------------------------------------------------------------------------
create table public.newsletter_suppression_records (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  reason public.suppression_reason not null,
  note text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Template email
-- -----------------------------------------------------------------------------
create table public.newsletter_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  heading text not null default 'Kabar Terbaru Sekolah' check (char_length(heading) <= 120),
  intro text not null default '' check (char_length(intro) <= 1000),
  footer_note text not null default '' check (char_length(footer_note) <= 500),
  accent_color text not null default '#1d4ed8' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index newsletter_templates_one_default on public.newsletter_templates (is_default) where is_default;
create trigger newsletter_templates_set_updated_at before update on public.newsletter_templates
for each row execute function public.set_updated_at();

insert into public.newsletter_templates (name, heading, intro, footer_note, is_default)
values ('Standar', 'Kabar Terbaru Sekolah',
        'Berikut berita dan informasi terbaru dari sekolah.',
        'Anda menerima email ini karena berlangganan berita sekolah melalui website resmi.',
        true);

-- -----------------------------------------------------------------------------
-- Kampanye
-- -----------------------------------------------------------------------------
create table public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 3 and 150),
  heading text check (heading is null or char_length(heading) <= 120),
  intro text check (intro is null or char_length(intro) <= 1000),
  template_id uuid references public.newsletter_templates (id) on delete set null,
  mode text not null default 'manual' check (mode in ('manual', 'auto')),
  status public.campaign_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger newsletter_campaigns_set_updated_at before update on public.newsletter_campaigns
for each row execute function public.set_updated_at();

create table public.newsletter_campaign_items (
  campaign_id uuid not null references public.newsletter_campaigns (id) on delete cascade,
  news_id uuid not null references public.news (id) on delete restrict,
  position integer not null default 0,
  primary key (campaign_id, news_id)
);

-- Hanya berita yang boleh didistribusikan publik yang dapat dimasukkan.
create function public.newsletter_news_is_distributable(p_news_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.news n
    where n.id = p_news_id
      and n.status = 'published'
      and n.visibility = 'public'
      and n.newsletter_eligible
      and n.published_at <= now()
  );
$$;

create function public.newsletter_campaign_items_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status public.campaign_status;
begin
  select status into v_status from public.newsletter_campaigns where id = new.campaign_id;
  if v_status is distinct from 'draft' then
    raise exception 'campaign_not_editable' using errcode = '42501';
  end if;
  if not public.newsletter_news_is_distributable(new.news_id) then
    raise exception 'news_not_distributable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger newsletter_campaign_items_guard before insert or update on public.newsletter_campaign_items
for each row execute function public.newsletter_campaign_items_guard();

-- -----------------------------------------------------------------------------
-- Pengiriman per penerima (satu baris = satu email ke satu pelanggan)
-- -----------------------------------------------------------------------------
create table public.newsletter_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns (id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers (id) on delete cascade,
  status public.delivery_status not null default 'queued',
  attempts integer not null default 0,
  permanent_failure boolean not null default false,
  provider_message_id text,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  -- Mencegah satu pelanggan menerima kampanye yang sama dua kali.
  unique (campaign_id, subscriber_id)
);
create index newsletter_deliveries_campaign_status on public.newsletter_deliveries (campaign_id, status);
create index newsletter_deliveries_provider_msg on public.newsletter_deliveries (provider_message_id);

-- Peristiwa dari penyedia email (webhook). Payload mentah TIDAK disimpan
-- agar alamat email tidak tersebar di tabel ini.
create table public.newsletter_delivery_events (
  id bigint generated always as identity primary key,
  provider_event_id text unique,
  delivery_id uuid references public.newsletter_deliveries (id) on delete cascade,
  provider_message_id text,
  event_type text not null,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Pembatasan laju (anti-spam formulir)
-- -----------------------------------------------------------------------------
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_hits_lookup on public.rate_limit_hits (bucket, key_hash, created_at);

create function public.check_rate_limit(
  p_bucket text, p_key_hash text, p_max integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_key_hash));
  select count(*) into v_count from public.rate_limit_hits
   where bucket = p_bucket and key_hash = p_key_hash
     and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    return false;
  end if;
  insert into public.rate_limit_hits (bucket, key_hash) values (p_bucket, p_key_hash);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi alur langganan (dipanggil server dengan service role)
-- -----------------------------------------------------------------------------

-- Konfirmasi: memvalidasi hash token, kedaluwarsa, sekali pakai. Mengembalikan
-- true bila langganan aktif setelah pemanggilan.
create function public.newsletter_confirm(p_token_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_tok public.newsletter_confirmation_tokens;
  v_sub public.newsletter_subscribers;
begin
  select * into v_tok from public.newsletter_confirmation_tokens
   where token_hash = p_token_hash for update;
  if not found or v_tok.used_at is not null or v_tok.expires_at < now() then
    return false;
  end if;

  update public.newsletter_confirmation_tokens set used_at = now() where id = v_tok.id;
  -- Token lain milik pelanggan yang sama ikut tidak berlaku.
  update public.newsletter_confirmation_tokens set used_at = now()
   where subscriber_id = v_tok.subscriber_id and used_at is null;

  select * into v_sub from public.newsletter_subscribers where id = v_tok.subscriber_id for update;
  if not found or v_sub.email is null then
    return false;
  end if;

  -- Bounce/keluhan spam tetap diblokir. Penolakan karena berhenti
  -- berlangganan dicabut karena pemilik email memilih berlangganan lagi.
  if exists (select 1 from public.newsletter_suppression_records s
             where s.email_hash = public.newsletter_email_hash(v_sub.email::text)
               and s.reason in ('bounced', 'complained', 'manual')) then
    return false;
  end if;
  delete from public.newsletter_suppression_records
   where email_hash = public.newsletter_email_hash(v_sub.email::text) and reason = 'unsubscribed';

  update public.newsletter_subscribers
     set status = 'active', confirmed_at = now(), unsubscribed_at = null
   where id = v_sub.id;
  return true;
end;
$$;

-- Berhenti berlangganan: idempoten. Versi token harus cocok.
create function public.newsletter_unsubscribe(p_subscriber_id uuid, p_token_version integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.newsletter_subscribers;
begin
  select * into v_sub from public.newsletter_subscribers where id = p_subscriber_id for update;
  if not found or v_sub.unsubscribe_token_version <> p_token_version then
    return false;
  end if;

  if v_sub.email is not null then
    insert into public.newsletter_suppression_records (email_hash, reason)
    values (public.newsletter_email_hash(v_sub.email::text), 'unsubscribed')
    on conflict (email_hash) do nothing;
  end if;

  if v_sub.status <> 'unsubscribed' then
    update public.newsletter_subscribers
       set status = 'unsubscribed', unsubscribed_at = now()
     where id = v_sub.id;
  end if;

  -- Batalkan pengiriman yang masih antre untuk alamat ini.
  update public.newsletter_deliveries set status = 'skipped', last_error = 'unsubscribed'
   where subscriber_id = v_sub.id and status in ('queued', 'failed');
  return true;
end;
$$;

-- Memasukkan semua pelanggan aktif (dan tidak ditolak) ke antrean kampanye.
-- Aman dipanggil berulang: baris yang sudah ada tidak diduplikasi.
create function public.newsletter_enqueue_campaign(p_campaign_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_status public.campaign_status;
  v_count integer;
begin
  select status into v_status from public.newsletter_campaigns where id = p_campaign_id for update;
  if v_status not in ('approved', 'sending') then
    raise exception 'campaign_not_approved' using errcode = '42501';
  end if;

  insert into public.newsletter_deliveries (campaign_id, subscriber_id)
  select p_campaign_id, s.id
    from public.newsletter_subscribers s
   where s.status = 'active' and s.email is not null
     and not exists (select 1 from public.newsletter_suppression_records r
                     where r.email_hash = public.newsletter_email_hash(s.email::text))
  on conflict (campaign_id, subscriber_id) do nothing;
  get diagnostics v_count = row_count;

  update public.newsletter_campaigns
     set status = 'sending', started_at = coalesce(started_at, now())
   where id = p_campaign_id;
  return v_count;
end;
$$;

-- Mengklaim sejumlah pengiriman untuk diproses. FOR UPDATE SKIP LOCKED
-- mencegah dua proses mengirim email yang sama bersamaan. Baris yang macet
-- di 'sending' lebih lama dari p_stale_seconds dicoba lagi (penyedia email
-- menerima idempotency key yang sama sehingga tidak terjadi duplikat).
create function public.newsletter_claim_deliveries(
  p_campaign_id uuid, p_limit integer, p_max_attempts integer, p_stale_seconds integer
) returns table (
  delivery_id uuid,
  subscriber_id uuid,
  email text,
  subscriber_status public.subscriber_status,
  unsubscribe_token_version integer,
  suppressed boolean,
  attempts integer
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select d.id from public.newsletter_deliveries d
     where d.campaign_id = p_campaign_id
       and (
         d.status = 'queued'
         or (d.status = 'failed' and not d.permanent_failure and d.attempts < p_max_attempts)
         or (d.status = 'sending' and d.last_attempt_at < now() - make_interval(secs => p_stale_seconds))
       )
     order by d.created_at
     limit p_limit
     for update skip locked
  ), updated as (
    update public.newsletter_deliveries d
       set status = 'sending', attempts = d.attempts + 1, last_attempt_at = now()
      from picked where d.id = picked.id
    returning d.id, d.subscriber_id, d.attempts
  )
  select u.id, s.id, s.email::text, s.status, s.unsubscribe_token_version,
         (s.email is null or exists (select 1 from public.newsletter_suppression_records r
                                     where r.email_hash = public.newsletter_email_hash(s.email::text))),
         u.attempts
    from updated u join public.newsletter_subscribers s on s.id = u.subscriber_id;
end;
$$;

-- Ringkasan status pengiriman sebuah kampanye.
create function public.newsletter_campaign_counts(p_campaign_id uuid, p_max_attempts integer)
returns table (
  total bigint, sent bigint, failed_final bigint, pending bigint, skipped bigint,
  bounced bigint, complained bigint
)
-- security invoker: admin dibatasi RLS, service role melihat semua.
language sql stable set search_path = '' as $$
  select
    count(*),
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed' and (permanent_failure or attempts >= p_max_attempts)),
    count(*) filter (where status in ('queued', 'sending')
                        or (status = 'failed' and not permanent_failure and attempts < p_max_attempts)),
    count(*) filter (where status = 'skipped'),
    count(*) filter (where status = 'bounced'),
    count(*) filter (where status = 'complained')
  from public.newsletter_deliveries where campaign_id = p_campaign_id;
$$;

-- Retensi: hapus token kedaluwarsa, pendaftaran yang tidak dikonfirmasi
-- lebih dari 30 hari, dan catatan rate limit lama.
create function public.newsletter_purge_stale() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tokens integer;
  v_pending integer;
  v_hits integer;
begin
  delete from public.newsletter_confirmation_tokens
   where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day';
  get diagnostics v_tokens = row_count;

  delete from public.newsletter_subscribers
   where status = 'pending' and confirmed_at is null and requested_at < now() - interval '30 days'
     and not exists (select 1 from public.newsletter_deliveries d where d.subscriber_id = newsletter_subscribers.id);
  get diagnostics v_pending = row_count;

  delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  get diagnostics v_hits = row_count;

  return jsonb_build_object('tokens', v_tokens, 'pending_subscribers', v_pending, 'rate_limit_hits', v_hits);
end;
$$;

-- Anonimkan pelanggan (permintaan penghapusan data). Hash email tetap
-- disimpan di daftar penolakan agar tidak terkirim lagi.
create function public.newsletter_anonymize_subscriber(p_subscriber_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_sub public.newsletter_subscribers;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_sub from public.newsletter_subscribers where id = p_subscriber_id for update;
  if not found then
    raise exception 'subscriber_not_found' using errcode = 'P0002';
  end if;
  if v_sub.email is not null then
    insert into public.newsletter_suppression_records (email_hash, reason, note)
    values (public.newsletter_email_hash(v_sub.email::text), 'manual', 'anonymized')
    on conflict (email_hash) do update set reason = 'manual', note = 'anonymized';
  end if;
  update public.newsletter_subscribers
     set email = null, status = 'unsubscribed', anonymized_at = now(),
         unsubscribed_at = coalesce(unsubscribed_at, now()),
         unsubscribe_token_version = unsubscribe_token_version + 1
   where id = p_subscriber_id;
  delete from public.newsletter_confirmation_tokens where subscriber_id = p_subscriber_id;
  update public.newsletter_deliveries set status = 'skipped', last_error = 'anonymized'
   where subscriber_id = p_subscriber_id and status in ('queued', 'failed');
  insert into public.admin_audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'newsletter.anonymize', 'newsletter_subscriber', p_subscriber_id::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security: hanya admin (anon tidak punya akses sama sekali)
-- -----------------------------------------------------------------------------
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_confirmation_tokens enable row level security;
alter table public.newsletter_suppression_records enable row level security;
alter table public.newsletter_templates enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_campaign_items enable row level security;
alter table public.newsletter_deliveries enable row level security;
alter table public.newsletter_delivery_events enable row level security;
alter table public.rate_limit_hits enable row level security;

create policy subscribers_admin_select on public.newsletter_subscribers
  for select to authenticated using (public.is_admin());
create policy suppression_admin_select on public.newsletter_suppression_records
  for select to authenticated using (public.is_admin());
create policy templates_admin_all on public.newsletter_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy campaigns_admin_select on public.newsletter_campaigns
  for select to authenticated using (public.is_admin());
create policy campaigns_admin_insert on public.newsletter_campaigns
  for insert to authenticated with check (public.is_admin() and status = 'draft');
-- Admin hanya mengubah kampanye draf lewat API biasa; persetujuan dan
-- pengiriman dilakukan server setelah pemeriksaan tambahan.
create policy campaigns_admin_update_draft on public.newsletter_campaigns
  for update to authenticated
  using (public.is_admin() and status = 'draft')
  with check (public.is_admin() and status in ('draft', 'cancelled'));
create policy campaigns_admin_delete_draft on public.newsletter_campaigns
  for delete to authenticated using (public.is_admin() and status = 'draft');
create policy campaign_items_admin_all on public.newsletter_campaign_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy deliveries_admin_select on public.newsletter_deliveries
  for select to authenticated using (public.is_admin());
create policy delivery_events_admin_select on public.newsletter_delivery_events
  for select to authenticated using (public.is_admin());
-- newsletter_confirmation_tokens & rate_limit_hits: tanpa policy = hanya service role.

revoke all on public.newsletter_subscribers, public.newsletter_confirmation_tokens,
  public.newsletter_suppression_records, public.newsletter_templates, public.newsletter_campaigns,
  public.newsletter_campaign_items, public.newsletter_deliveries, public.newsletter_delivery_events,
  public.rate_limit_hits from anon, authenticated;
revoke all on sequence public.newsletter_delivery_events_id_seq, public.rate_limit_hits_id_seq from anon, authenticated;

grant select on public.newsletter_subscribers to authenticated;
grant select on public.newsletter_suppression_records to authenticated;
grant select, insert, update, delete on public.newsletter_templates to authenticated;
grant select, insert, update, delete on public.newsletter_campaigns to authenticated;
grant select, insert, update, delete on public.newsletter_campaign_items to authenticated;
grant select on public.newsletter_deliveries to authenticated;
grant select on public.newsletter_delivery_events to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke all on function public.newsletter_email_hash(text) from public, anon, authenticated;
revoke all on function public.newsletter_news_is_distributable(uuid) from public, anon;
revoke all on function public.newsletter_campaign_items_guard() from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.newsletter_confirm(text) from public, anon, authenticated;
revoke all on function public.newsletter_unsubscribe(uuid, integer) from public, anon, authenticated;
revoke all on function public.newsletter_enqueue_campaign(uuid) from public, anon, authenticated;
revoke all on function public.newsletter_claim_deliveries(uuid, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.newsletter_campaign_counts(uuid, integer) from public, anon, authenticated;
revoke all on function public.newsletter_purge_stale() from public, anon, authenticated;
revoke all on function public.newsletter_anonymize_subscriber(uuid) from public, anon;

grant execute on function public.newsletter_email_hash(text) to service_role;
grant execute on function public.newsletter_news_is_distributable(uuid) to authenticated, service_role;
grant execute on function public.check_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.newsletter_confirm(text) to service_role;
grant execute on function public.newsletter_unsubscribe(uuid, integer) to service_role;
grant execute on function public.newsletter_enqueue_campaign(uuid) to service_role;
grant execute on function public.newsletter_claim_deliveries(uuid, integer, integer, integer) to service_role;
grant execute on function public.newsletter_campaign_counts(uuid, integer) to authenticated, service_role;
grant execute on function public.newsletter_purge_stale() to service_role;
grant execute on function public.newsletter_anonymize_subscriber(uuid) to authenticated;
