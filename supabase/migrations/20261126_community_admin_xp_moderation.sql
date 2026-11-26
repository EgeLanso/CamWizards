-- CamWizards community, roles, XP, moderation and chat.
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.uploads add column if not exists moderation_status text not null default 'approved';
alter table public.uploads add column if not exists originality_status text not null default 'unverified';
alter table public.uploads add column if not exists moderation_note text;
alter table public.uploads add column if not exists gear_check_note text;
alter table public.upload_media add column if not exists content_hash text;
create index if not exists upload_media_content_hash_idx on public.upload_media(content_hash) where content_hash is not null;
alter table public.uploads drop constraint if exists uploads_moderation_status_check;
alter table public.uploads add constraint uploads_moderation_status_check
  check (moderation_status in ('pending','approved','rejected','needs_review'));
alter table public.uploads drop constraint if exists uploads_originality_status_check;
alter table public.uploads add constraint uploads_originality_status_check
  check (originality_status in ('unverified','likely_original','possible_edit','uncertain'));

create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_bans_user_active_idx on public.user_bans(user_id, expires_at desc) where revoked_at is null;

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 1000),
  reason text not null,
  source_type text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique(user_id, source_type, source_id)
);
create index if not exists xp_events_user_created_idx on public.xp_events(user_id, created_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','visible','removed')),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_created_idx on public.chat_messages(created_at desc);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  content_type text not null,
  content_id text,
  decision text not null,
  categories jsonb not null default '[]'::jsonb,
  reason text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_logs_created_idx on public.moderation_logs(created_at desc);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  upload_id uuid references public.uploads(id) on delete cascade,
  chat_message_id uuid references public.chat_messages(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(target_user_id, upload_id, chat_message_id) = 1)
);
create index if not exists user_reports_status_created_idx on public.user_reports(status, created_at desc);

alter table public.user_roles enable row level security;
alter table public.user_bans enable row level security;
alter table public.xp_events enable row level security;
alter table public.chat_messages enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists "user roles read self" on public.user_roles;
create policy "user roles read self" on public.user_roles for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "user bans read self" on public.user_bans;
create policy "user bans read self" on public.user_bans for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "xp events read public" on public.xp_events;
create policy "xp events read public" on public.xp_events for select using (true);

drop policy if exists "chat visible read" on public.chat_messages;
create policy "chat visible read" on public.chat_messages for select using (
  status = 'visible' or user_id = (select auth.uid())
);

drop policy if exists "reports insert self" on public.user_reports;
create policy "reports insert self" on public.user_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
drop policy if exists "reports read self" on public.user_reports;
create policy "reports read self" on public.user_reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- Public feeds can only read approved content. Owners can still see their own pending/rejected posts.
drop policy if exists "uploads public read active" on public.uploads;
create policy "uploads public read active" on public.uploads for select using (
  ((expires_at is null or expires_at > now()) and moderation_status = 'approved')
  or (select auth.uid()) = user_id
);



-- Restrict category and gallery metadata to approved posts (or their owner).
drop policy if exists "categories public read" on public.upload_categories;
create policy "categories public read" on public.upload_categories for select using (
  exists (select 1 from public.uploads u where u.id = upload_id
    and (((u.expires_at is null or u.expires_at > now()) and u.moderation_status = 'approved')
      or u.user_id = (select auth.uid())))
);

drop policy if exists "upload media public read" on public.upload_media;
create policy "upload media public read" on public.upload_media for select using (
  exists (select 1 from public.uploads u where u.id = upload_id
    and (((u.expires_at is null or u.expires_at > now()) and u.moderation_status = 'approved')
      or u.user_id = (select auth.uid())))
);

-- Suspended users cannot create new posts or upload new storage objects directly.
drop policy if exists "uploads owner insert" on public.uploads;
create policy "uploads owner insert" on public.uploads for insert to authenticated with check (
  (select auth.uid()) = user_id
  and not exists (select 1 from public.user_bans b where b.user_id = (select auth.uid())
    and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()))
);

drop policy if exists "photo owner insert" on storage.objects;
create policy "photo owner insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.user_bans b where b.user_id = (select auth.uid())
    and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()))
);

drop policy if exists "video owner insert" on storage.objects;
create policy "video owner insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.user_bans b where b.user_id = (select auth.uid())
    and b.revoked_at is null and (b.expires_at is null or b.expires_at > now()))
);

-- Prevent users from awarding themselves XP or bypassing moderation through direct Supabase calls.
create or replace function public.guard_community_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    if tg_table_name = 'profiles' then
      if tg_op = 'UPDATE' and new.xp is distinct from old.xp then
        raise exception 'XP is managed by CamWizards and cannot be edited directly';
      end if;
    elsif tg_table_name = 'uploads' then
      if tg_op = 'INSERT' then
        new.moderation_status := 'pending';
        new.originality_status := 'unverified';
        new.moderation_note := null;
      elsif tg_op = 'UPDATE' then
        new.moderation_status := old.moderation_status;
        new.originality_status := old.originality_status;
        new.moderation_note := old.moderation_note;
      end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists guard_profile_xp on public.profiles;
create trigger guard_profile_xp before update on public.profiles
for each row execute function public.guard_community_fields();
drop trigger if exists guard_upload_moderation on public.uploads;
create trigger guard_upload_moderation before insert or update on public.uploads
for each row execute function public.guard_community_fields();

-- Award XP exactly once per source event. Only the server's service role can execute this function.
create or replace function public.award_xp(p_user_id uuid, p_amount integer, p_reason text, p_source_type text, p_source_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  if p_amount < 1 or p_amount > 100 or p_reason is null or p_source_type is null or p_source_id is null then
    raise exception 'Invalid XP award';
  end if;
  insert into public.xp_events(user_id, amount, reason, source_type, source_id)
  values (p_user_id, p_amount, p_reason, p_source_type, p_source_id)
  on conflict (user_id, source_type, source_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then
    update public.profiles set xp = xp + p_amount where id = p_user_id;
    return true;
  end if;
  return false;
end; $$;

revoke all on function public.award_xp(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.award_xp(uuid, integer, text, text, text) to service_role;

-- Realtime updates for the lounge. Ignore the duplicate publication entry on re-runs.
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
