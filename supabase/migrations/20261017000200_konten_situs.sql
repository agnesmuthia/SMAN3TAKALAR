-- =============================================================================
-- Konten situs yang dikelola lewat CMS (tanpa coding):
--   profil sekolah (kontak, media sosial, hero, logo), halaman (profil,
--   visi-misi, dst.), program unggulan, galeri, prestasi, kalender kegiatan,
--   dan pengumuman publik.
--
-- Prinsip:
--   * Pengunjung hanya membaca konten yang DITERBITKAN.
--   * Penulisan hanya oleh penerbit konten: Super Admin & Admin Website
--     (can_publish_news()). Editor tetap terbatas pada berita.
--   * Tidak ada data contoh: tabel dimulai kosong (profil sekolah satu baris kosong).
--   * Album galeri hanya dapat diterbitkan setelah konfirmasi izin publikasi foto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profil sekolah (satu baris)
-- -----------------------------------------------------------------------------
create table public.site_profile (
  id boolean primary key default true check (id),
  hero_title text check (hero_title is null or char_length(hero_title) <= 120),
  hero_subtitle text check (hero_subtitle is null or char_length(hero_subtitle) <= 300),
  hero_image_url text check (hero_image_url is null or hero_image_url ~ '^https://'),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  address text check (address is null or char_length(address) <= 300),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 254),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{8,16}$'),
  maps_url text check (maps_url is null or maps_url ~ '^https://'),
  instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
  facebook_url text check (facebook_url is null or facebook_url ~ '^https://'),
  youtube_url text check (youtube_url is null or youtube_url ~ '^https://'),
  tiktok_url text check (tiktok_url is null or tiktok_url ~ '^https://'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.site_profile (id) values (true);
create trigger site_profile_set_updated_at before update on public.site_profile
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Halaman (profil, visi-misi, sejarah, struktur, kontak, ...)
-- -----------------------------------------------------------------------------
create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 2 and 120),
  summary text not null default '' check (char_length(summary) <= 300),
  content text not null default '',
  -- HTML yang SUDAH disanitasi server (aturan sama dengan berita).
  content_html text check (content_html is null or char_length(content_html) <= 200000),
  is_published boolean not null default false,
  position integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger site_pages_set_updated_at before update on public.site_pages
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Program unggulan
-- -----------------------------------------------------------------------------
create table public.school_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 100),
  summary text not null default '' check (char_length(summary) <= 400),
  image_url text check (image_url is null or image_url ~ '^https://'),
  page_id uuid references public.site_pages (id) on delete set null,
  is_published boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger school_programs_set_updated_at before update on public.school_programs
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Galeri
-- -----------------------------------------------------------------------------
create table public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title text not null check (char_length(title) between 3 and 150),
  description text not null default '' check (char_length(description) <= 1000),
  event_date date,
  cover_photo_id uuid,
  is_published boolean not null default false,
  -- Bukti bahwa penerbit memastikan izin publikasi foto (terutama foto siswa).
  consent_confirmed_by uuid references public.profiles (id) on delete set null,
  consent_confirmed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_publish_needs_consent check (not is_published or consent_confirmed_at is not null)
);
create trigger gallery_albums_set_updated_at before update on public.gallery_albums
for each row execute function public.set_updated_at();

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.gallery_albums (id) on delete cascade,
  image_url text not null check (image_url ~ '^https://'),
  caption text not null default '' check (char_length(caption) <= 300),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_photos_by_album on public.gallery_photos (album_id, position);

alter table public.gallery_albums
  add constraint gallery_albums_cover_fk foreign key (cover_photo_id)
  references public.gallery_photos (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Prestasi
-- -----------------------------------------------------------------------------
create type public.achievement_level as enum
  ('sekolah', 'kecamatan', 'kabupaten', 'provinsi', 'nasional', 'internasional');

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  -- Nama penerima ditampilkan publik: isi hanya dengan izin siswa/orang tua.
  recipient text check (recipient is null or char_length(recipient) <= 200),
  level public.achievement_level not null,
  organizer text check (organizer is null or char_length(organizer) <= 200),
  achieved_on date not null,
  description text not null default '' check (char_length(description) <= 2000),
  image_url text check (image_url is null or image_url ~ '^https://'),
  news_id uuid references public.news (id) on delete set null,
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index achievements_listing on public.achievements (achieved_on desc) where is_published;
create trigger achievements_set_updated_at before update on public.achievements
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Kalender kegiatan
-- -----------------------------------------------------------------------------
create type public.event_category as enum ('akademik', 'ujian', 'libur', 'kegiatan', 'rapat', 'lainnya');

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 150),
  description text not null default '' check (char_length(description) <= 1000),
  category public.event_category not null default 'kegiatan',
  starts_on date not null,
  ends_on date not null,
  start_time time,
  end_time time,
  location text check (location is null or char_length(location) <= 150),
  visibility public.news_visibility not null default 'public',
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_dates_order check (ends_on >= starts_on),
  constraint calendar_times_order check (start_time is null or end_time is null or ends_on > starts_on or end_time > start_time)
);
create index calendar_events_range on public.calendar_events (starts_on, ends_on) where is_published;
create trigger calendar_events_set_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.site_profile enable row level security;
alter table public.site_pages enable row level security;
alter table public.school_programs enable row level security;
alter table public.gallery_albums enable row level security;
alter table public.gallery_photos enable row level security;
alter table public.achievements enable row level security;
alter table public.calendar_events enable row level security;

create policy site_profile_read on public.site_profile for select to anon, authenticated using (true);
create policy site_profile_publisher_update on public.site_profile
  for update to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

create policy site_pages_public_read on public.site_pages for select to anon, authenticated using (is_published);
create policy site_pages_publisher_all on public.site_pages
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

create policy programs_public_read on public.school_programs for select to anon, authenticated using (is_published);
create policy programs_publisher_all on public.school_programs
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

create policy albums_public_read on public.gallery_albums for select to anon, authenticated using (is_published);
create policy albums_publisher_all on public.gallery_albums
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());
-- Foto terlihat bila albumnya terlihat oleh pemanggil (RLS album berlaku di subquery).
create policy photos_read on public.gallery_photos
  for select to anon, authenticated using (exists (select 1 from public.gallery_albums a where a.id = album_id));
create policy photos_publisher_write on public.gallery_photos
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

create policy achievements_public_read on public.achievements for select to anon, authenticated using (is_published);
create policy achievements_publisher_all on public.achievements
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

create policy events_public_read on public.calendar_events
  for select to anon, authenticated using (is_published and visibility = 'public');
create policy events_member_internal_read on public.calendar_events
  for select to authenticated using (is_published and visibility = 'internal' and public.is_active_member());
create policy events_publisher_all on public.calendar_events
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

-- Pengumuman: audiens "publik" dapat dibaca pengunjung; penerbit konten
-- (Admin Website) kini dapat mengelola pengumuman bersama Super Admin.
create policy announcements_public_read on public.announcements
  for select to anon, authenticated
  using (status = 'published' and published_at <= now() and audience = 'publik');
create policy announcements_publisher_all on public.announcements
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

-- -----------------------------------------------------------------------------
-- Hak akses eksplisit
-- -----------------------------------------------------------------------------
revoke all on public.site_profile, public.site_pages, public.school_programs, public.gallery_albums,
  public.gallery_photos, public.achievements, public.calendar_events from anon, authenticated;

grant select on public.site_profile, public.site_pages, public.school_programs, public.gallery_albums,
  public.gallery_photos, public.achievements, public.calendar_events to anon, authenticated;
grant update on public.site_profile to authenticated;
grant insert, update, delete on public.site_pages, public.school_programs, public.gallery_albums,
  public.gallery_photos, public.achievements, public.calendar_events to authenticated;
grant all on public.site_profile, public.site_pages, public.school_programs, public.gallery_albums,
  public.gallery_photos, public.achievements, public.calendar_events to service_role;
grant select on public.announcements to anon;

-- -----------------------------------------------------------------------------
-- Bucket media situs (galeri, prestasi, program, logo, hero). Sama seperti
-- bucket berita: publik untuk dibaca, tulis hanya lewat server.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
