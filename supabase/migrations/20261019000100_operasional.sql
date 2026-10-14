-- =============================================================================
-- Tahap 6: dukungan operasional.
--   * Log otomatis perubahan konten penting ke admin_audit_log (siapa, kapan,
--     tabel, judul, NAMA kolom yang berubah). Isi konten tidak disalin ke log.
--   * admin_system_status(): pemeriksaan kesehatan tetap (bukan SQL bebas)
--     untuk Super Admin.
--   * school_purge_stale(): membersihkan pratinjau impor yang terbengkalai.
-- Migrasi aditif: tidak mengubah atau menghapus data.
-- =============================================================================

create function public.audit_content_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changed text[];
  v_actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
      from jsonb_each(v_new) n
     where n.key not in ('updated_at')
       and n.value is distinct from (v_old -> n.key);
    if cardinality(v_changed) = 0 then
      return null;
    end if;
  end if;
  -- Pelaku hanya dicatat bila memiliki profil (operasi service role = null).
  if v_actor is not null and not exists (select 1 from public.profiles where id = v_actor) then
    v_actor := null;
  end if;
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (
    v_actor,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', ''),
    jsonb_strip_nulls(jsonb_build_object(
      'label', left(coalesce(v_row ->> 'title', v_row ->> 'number', v_row ->> 'name', v_row ->> 'file_name'), 200),
      'changed', case when tg_op = 'UPDATE' then to_jsonb(v_changed) end
    ))
  );
  return null;
end;
$$;
revoke all on function public.audit_content_change() from public, anon, authenticated;

-- Konten & data administrasi yang perlu jejak siapa-mengubah-apa.
create trigger audit_decrees after insert or update or delete on public.decrees
  for each row execute function public.audit_content_change();
create trigger audit_library_items after insert or update or delete on public.library_items
  for each row execute function public.audit_content_change();
create trigger audit_academic_years after insert or update or delete on public.academic_years
  for each row execute function public.audit_content_change();
create trigger audit_semesters after insert or update or delete on public.semesters
  for each row execute function public.audit_content_change();
create trigger audit_schedule_import_batches after update or delete on public.schedule_import_batches
  for each row execute function public.audit_content_change();
create trigger audit_site_profile after update on public.site_profile
  for each row execute function public.audit_content_change();
create trigger audit_site_pages after insert or update or delete on public.site_pages
  for each row execute function public.audit_content_change();
create trigger audit_school_programs after insert or update or delete on public.school_programs
  for each row execute function public.audit_content_change();
create trigger audit_gallery_albums after insert or update or delete on public.gallery_albums
  for each row execute function public.audit_content_change();
create trigger audit_achievements after insert or update or delete on public.achievements
  for each row execute function public.audit_content_change();
create trigger audit_calendar_events after insert or update or delete on public.calendar_events
  for each row execute function public.audit_content_change();
create trigger audit_announcements after insert or update or delete on public.announcements
  for each row execute function public.audit_content_change();
-- Berita: perubahan isi sudah tercatat di news_revisions; log hanya penghapusan.
create trigger audit_news_delete after delete on public.news
  for each row execute function public.audit_content_change();

create index admin_audit_log_recent on public.admin_audit_log (created_at desc);

-- -----------------------------------------------------------------------------
-- Status sistem (hanya baca, daftar pemeriksaan tetap)
-- -----------------------------------------------------------------------------
create function public.admin_system_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tables text[] := array[
    'profiles', 'verification_requests', 'staff_roles', 'news', 'news_revisions', 'announcements',
    'newsletter_subscribers', 'newsletter_campaigns', 'newsletter_deliveries', 'site_pages',
    'gallery_albums', 'gallery_photos', 'achievements', 'calendar_events', 'academic_years',
    'semesters', 'schedule_entries', 'schedule_import_batches', 'assignments', 'decrees',
    'library_items', 'admin_audit_log'
  ];
  v_table text;
  v_counts jsonb := '{}'::jsonb;
  v_count bigint;
  v_migrations jsonb := null;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      v_counts := v_counts || jsonb_build_object(v_table, v_count);
    end if;
  end loop;

  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select jsonb_build_object(''latest'', max(version), ''count'', count(*)) from supabase_migrations.schema_migrations'
      into v_migrations;
  end if;

  select jsonb_build_object(
    'checked_at', now(),
    'database', current_setting('server_version'),
    'counts', v_counts,
    'migrations', v_migrations,
    'tables_without_rls', coalesce((
      select jsonb_agg(c.relname order by c.relname)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ), '[]'::jsonb),
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'public', b.public) order by b.id) from storage.buckets b
    ), '[]'::jsonb),
    'active_semester', (
      select y.name || ' · ' || case s.term when 1 then 'Ganjil' else 'Genap' end
        from public.semesters s join public.academic_years y on y.id = s.academic_year_id
       where s.is_active limit 1
    ),
    'pending', jsonb_build_object(
      'verifications', (select count(*) from public.verification_requests where status = 'submitted'),
      'news_review', (select count(*) from public.news where status = 'review'),
      'import_previews', (select count(*) from public.schedule_import_batches where status = 'pratinjau'),
      'decrees_unverified', (select count(*) from public.decrees where verified_at is null),
      'deliveries_queued', (select count(*) from public.newsletter_deliveries where status in ('queued', 'sending')),
      'deliveries_failed_7d', (select count(*) from public.newsletter_deliveries
                                where status in ('failed', 'bounced', 'complained')
                                  and coalesce(last_attempt_at, created_at) > now() - interval '7 days')
    ),
    'admins_active', (select count(*) from public.profiles where role = 'admin' and status = 'active'),
    'last_audit_at', (select max(created_at) from public.admin_audit_log)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_system_status() from public, anon;
grant execute on function public.admin_system_status() to authenticated;

-- -----------------------------------------------------------------------------
-- Pembersihan rutin (dipanggil cron dengan service role)
-- -----------------------------------------------------------------------------
create function public.school_purge_stale() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_previews integer;
begin
  delete from public.schedule_import_batches
   where status = 'pratinjau' and created_at < now() - interval '7 days';
  get diagnostics v_previews = row_count;
  return jsonb_build_object('import_previews', v_previews);
end;
$$;
revoke all on function public.school_purge_stale() from public, anon, authenticated;
grant execute on function public.school_purge_stale() to service_role;
