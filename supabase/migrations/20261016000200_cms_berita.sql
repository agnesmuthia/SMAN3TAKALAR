-- =============================================================================
-- CMS berita: peran staf (Admin Website, Editor), alur persetujuan, kategori,
-- tag, riwayat revisi, dan bucket gambar.
--
-- Model peran:
--   * profiles.role = 'admin'  -> Super Admin (semua kewenangan, seperti sebelumnya)
--   * staff_roles 'admin_website' -> mengelola & MENERBITKAN konten publik
--   * staff_roles 'editor'        -> menulis draf & mengirim untuk persetujuan
--   Peran staf adalah tambahan di atas peran dasar (mis. seorang guru dapat
--   menjadi editor) dan hanya berlaku bila akun AKTIF.
-- Semua perubahan bersifat aditif; data berita lama tidak diubah.
-- =============================================================================

create type public.staff_role as enum ('admin_website', 'editor');

create table public.staff_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function public.has_staff_role(p_role public.staff_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_roles s
    join public.profiles p on p.id = s.user_id
    where s.user_id = auth.uid() and s.role = p_role and p.status = 'active'
  );
$$;

-- Boleh menerbitkan/menyetujui/mengarsipkan berita.
create function public.can_publish_news() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.has_staff_role('admin_website');
$$;

-- Boleh menulis berita (minimal draf).
create function public.can_write_news() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_publish_news() or public.has_staff_role('editor');
$$;

-- Super Admin menetapkan peran staf seseorang (mengganti seluruh daftar).
create function public.admin_set_staff_roles(p_user_id uuid, p_roles public.staff_role[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.staff_role[];
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(array_length(p_roles, 1), 0) > 0
     and not exists (select 1 from public.profiles where id = p_user_id and status = 'active') then
    raise exception 'profile_not_active' using errcode = '22023';
  end if;

  select coalesce(array_agg(role order by role), '{}') into v_old
    from public.staff_roles where user_id = p_user_id;

  delete from public.staff_roles where user_id = p_user_id and not (role = any (coalesce(p_roles, '{}')));
  insert into public.staff_roles (user_id, role, granted_by)
  select p_user_id, r, auth.uid() from unnest(coalesce(p_roles, '{}')) as r
  on conflict (user_id, role) do nothing;

  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), 'user.set_staff_roles', 'profile', p_user_id::text,
          jsonb_build_object('old', v_old, 'new', coalesce(p_roles, '{}')));
end;
$$;

-- -----------------------------------------------------------------------------
-- Kategori & tag
-- -----------------------------------------------------------------------------
create table public.news_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text check (description is null or char_length(description) <= 300),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Kategori awal yang netral; dapat diubah/dihapus admin.
insert into public.news_categories (name, slug, position) values
  ('Kegiatan Sekolah', 'kegiatan-sekolah', 1),
  ('Prestasi', 'prestasi', 2),
  ('Akademik', 'akademik', 3),
  ('Informasi', 'informasi', 4);

create table public.news_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Kolom alur kerja pada berita
-- -----------------------------------------------------------------------------
alter table public.news
  add column category_id uuid references public.news_categories (id) on delete set null,
  -- HTML yang SUDAH disanitasi server. Kolom `content` tetap berisi versi teks
  -- untuk pencarian, estimasi waktu baca, dan berita lama.
  add column content_html text check (content_html is null or char_length(content_html) <= 200000),
  add column review_note text check (review_note is null or char_length(review_note) <= 1000),
  add column submitted_at timestamptz,
  add column approved_by uuid references public.profiles (id) on delete set null,
  add column approved_at timestamptz;

create index news_by_category on public.news (category_id, published_at desc)
  where status = 'published' and visibility = 'public';

create table public.news_tag_links (
  news_id uuid not null references public.news (id) on delete cascade,
  tag_id uuid not null references public.news_tags (id) on delete cascade,
  primary key (news_id, tag_id)
);
create index news_tag_links_by_tag on public.news_tag_links (tag_id);

-- Penjaga alur: hanya penerbit yang dapat mengisi kolom persetujuan; status
-- "review" mencatat waktu pengajuan; penerbitan mencatat penyetuju.
create function public.news_workflow_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_trusted boolean := auth.uid() is null; -- service role / migrasi
  v_publisher boolean := v_trusted or public.can_publish_news();
begin
  if not v_publisher then
    if tg_op = 'UPDATE' then
      new.approved_by := old.approved_by;
      new.approved_at := old.approved_at;
      new.review_note := old.review_note;
    else
      new.approved_by := null;
      new.approved_at := null;
      new.review_note := null;
    end if;
  end if;

  if new.status = 'review' and (tg_op = 'INSERT' or old.status is distinct from 'review') then
    new.submitted_at := now();
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.approved_at := now();
    new.review_note := null;
  end if;
  return new;
end;
$$;

create trigger news_workflow_guard before insert or update on public.news
for each row execute function public.news_workflow_guard();

-- -----------------------------------------------------------------------------
-- Riwayat revisi (dicatat otomatis oleh trigger)
-- -----------------------------------------------------------------------------
create table public.news_revisions (
  id bigint generated always as identity primary key,
  news_id uuid not null references public.news (id) on delete cascade,
  revision_no integer not null,
  title text not null,
  excerpt text not null,
  content text not null,
  content_html text,
  cover_image_url text,
  category_id uuid,
  status public.news_status not null,
  edited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (news_id, revision_no)
);

create function public.news_record_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.excerpt is not distinct from old.excerpt
     and new.content is not distinct from old.content
     and new.content_html is not distinct from old.content_html
     and new.cover_image_url is not distinct from old.cover_image_url
     and new.category_id is not distinct from old.category_id
     and new.status is not distinct from old.status then
    return new;
  end if;
  insert into public.news_revisions
    (news_id, revision_no, title, excerpt, content, content_html, cover_image_url, category_id, status, edited_by)
  values (
    new.id,
    coalesce((select max(revision_no) from public.news_revisions where news_id = new.id), 0) + 1,
    new.title, new.excerpt, new.content, new.content_html, new.cover_image_url, new.category_id, new.status,
    auth.uid()
  );
  return new;
end;
$$;

create trigger news_record_revision after insert or update on public.news
for each row execute function public.news_record_revision();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.staff_roles enable row level security;
alter table public.news_categories enable row level security;
alter table public.news_tags enable row level security;
alter table public.news_tag_links enable row level security;
alter table public.news_revisions enable row level security;

create policy staff_roles_select_own on public.staff_roles
  for select to authenticated using (user_id = auth.uid());
create policy staff_roles_select_admin on public.staff_roles
  for select to authenticated using (public.is_admin());

-- Berita: penerbit membaca/menulis semua (hapus tetap hanya Super Admin lewat
-- news_admin_all); editor hanya berita miliknya yang masih draf/review.
create policy news_publisher_select on public.news
  for select to authenticated using (public.can_publish_news());
create policy news_publisher_insert on public.news
  for insert to authenticated with check (public.can_publish_news());
create policy news_publisher_update on public.news
  for update to authenticated using (public.can_publish_news()) with check (public.can_publish_news());
create policy news_editor_select on public.news
  for select to authenticated using (author_id = auth.uid() and public.can_write_news());
create policy news_editor_insert on public.news
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_write_news() and status in ('draft', 'review'));
create policy news_editor_update on public.news
  for update to authenticated
  using (author_id = auth.uid() and public.can_write_news() and status in ('draft', 'review'))
  with check (author_id = auth.uid() and status in ('draft', 'review'));

-- Kategori: dibaca semua orang, dikelola penerbit.
create policy news_categories_read on public.news_categories
  for select to anon, authenticated using (true);
create policy news_categories_publisher_write on public.news_categories
  for all to authenticated using (public.can_publish_news()) with check (public.can_publish_news());

-- Tag: dibaca semua orang; penulis boleh membuat tag baru; penerbit mengelola.
create policy news_tags_read on public.news_tags
  for select to anon, authenticated using (true);
create policy news_tags_writer_insert on public.news_tags
  for insert to authenticated with check (public.can_write_news());
create policy news_tags_publisher_modify on public.news_tags
  for update to authenticated using (public.can_publish_news()) with check (public.can_publish_news());
create policy news_tags_publisher_delete on public.news_tags
  for delete to authenticated using (public.can_publish_news());

-- Tautan tag: terlihat bila beritanya terlihat oleh pemanggil (RLS berita
-- ikut berlaku di subquery), dapat diubah penerbit atau penulis drafnya.
create policy news_tag_links_read on public.news_tag_links
  for select to anon, authenticated
  using (exists (select 1 from public.news n where n.id = news_id));
create policy news_tag_links_write on public.news_tag_links
  for insert to authenticated
  with check (
    public.can_publish_news()
    or exists (select 1 from public.news n where n.id = news_id and n.author_id = auth.uid()
               and n.status in ('draft', 'review') and public.can_write_news())
  );
create policy news_tag_links_delete on public.news_tag_links
  for delete to authenticated
  using (
    public.can_publish_news()
    or exists (select 1 from public.news n where n.id = news_id and n.author_id = auth.uid()
               and n.status in ('draft', 'review') and public.can_write_news())
  );

-- Revisi: penerbit melihat semua; editor melihat revisi beritanya sendiri.
create policy news_revisions_read on public.news_revisions
  for select to authenticated
  using (
    public.can_publish_news()
    or (public.can_write_news() and exists (select 1 from public.news n where n.id = news_id and n.author_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Hak akses eksplisit
-- -----------------------------------------------------------------------------
revoke all on public.staff_roles, public.news_categories, public.news_tags, public.news_tag_links,
  public.news_revisions from anon, authenticated;
revoke all on sequence public.news_revisions_id_seq from anon, authenticated;

grant select on public.staff_roles to authenticated;
grant select on public.news_categories, public.news_tags, public.news_tag_links to anon, authenticated;
grant insert, update, delete on public.news_categories to authenticated;
grant insert, update, delete on public.news_tags to authenticated;
grant insert, delete on public.news_tag_links to authenticated;
grant select on public.news_revisions to authenticated;
grant all on public.staff_roles, public.news_categories, public.news_tags, public.news_tag_links,
  public.news_revisions to service_role;
grant all on sequence public.news_revisions_id_seq to service_role;

revoke all on function public.has_staff_role(public.staff_role) from public, anon;
revoke all on function public.can_publish_news() from public, anon;
revoke all on function public.can_write_news() from public, anon;
revoke all on function public.admin_set_staff_roles(uuid, public.staff_role[]) from public, anon;
revoke all on function public.news_workflow_guard() from public, anon, authenticated;
revoke all on function public.news_record_revision() from public, anon, authenticated;
grant execute on function public.has_staff_role(public.staff_role) to authenticated, service_role;
grant execute on function public.can_publish_news() to authenticated, service_role;
grant execute on function public.can_write_news() to authenticated, service_role;
grant execute on function public.admin_set_staff_roles(uuid, public.staff_role[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Bucket gambar berita (Supabase Storage)
-- Publik untuk dibaca lewat URL; TIDAK ada policy tulis untuk anon/authenticated,
-- sehingga unggahan hanya lewat server (service role) setelah cek can_write_news().
-- Nama file acak (UUID) sehingga gambar draf tidak dapat ditebak.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news-images', 'news-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
