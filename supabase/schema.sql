create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- NOT VALID: new and updated rows must match, existing rows are not re-checked.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9_]{3,24}$') not valid;

create table if not exists public.cameras (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  brand text,
  is_camcorder boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lenses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  brand text,
  created_at timestamptz not null default now()
);

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video')),
  storage_path text not null,
  title text not null,
  description text,
  camera_id uuid not null references public.cameras(id),
  lens_id uuid references public.lenses(id),
  camera_name text not null,
  lens_name text,
  camera_price numeric check (camera_price is null or camera_price >= 0),
  currency text,
  purchased_from text,
  condition text check (condition in ('new','used')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.upload_media (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (upload_id, storage_path)
);

create table if not exists public.upload_categories (
  upload_id uuid not null references public.uploads(id) on delete cascade,
  category text not null check (category in ('Street','Wildlife','Animals','Architecture','Landscape','Astrophotography','Portrait','Cars','Night','Other')),
  primary key(upload_id, category)
);

create table if not exists public.likes (
  upload_id uuid not null references public.uploads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(upload_id,user_id)
);

create index if not exists uploads_camera_idx on public.uploads(camera_id);
create index if not exists uploads_lens_idx on public.uploads(lens_id);
create index if not exists uploads_user_idx on public.uploads(user_id);
create index if not exists uploads_created_idx on public.uploads(created_at desc);
create index if not exists upload_categories_category_idx on public.upload_categories(category);
create index if not exists likes_user_idx on public.likes(user_id);

alter table public.profiles enable row level security;
alter table public.cameras enable row level security;
alter table public.lenses enable row level security;
alter table public.uploads enable row level security;
alter table public.upload_categories enable row level security;
alter table public.upload_media enable row level security;

grant select on public.upload_media to anon, authenticated;
grant insert, delete on public.upload_media to authenticated;
alter table public.likes enable row level security;

-- Policies are dropped first so this file can be re-run safely.
drop policy if exists "profiles public read" on public.profiles;
drop policy if exists "profiles self insert" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles self insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles self update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Cameras and lenses: anyone can read, signed-in users can add new entries.
-- No update policy: otherwise any user could rename or rewrite shared gear records.
drop policy if exists "cameras public read" on public.cameras;
drop policy if exists "cameras authenticated insert" on public.cameras;
drop policy if exists "cameras authenticated update" on public.cameras;
create policy "cameras public read" on public.cameras for select using (true);
create policy "cameras authenticated insert" on public.cameras for insert to authenticated with check (true);

drop policy if exists "lenses public read" on public.lenses;
drop policy if exists "lenses authenticated insert" on public.lenses;
drop policy if exists "lenses authenticated update" on public.lenses;
create policy "lenses public read" on public.lenses for select using (true);
create policy "lenses authenticated insert" on public.lenses for insert to authenticated with check (true);

-- Owners can always see their own uploads, including expired videos, so they can renew or delete them.
drop policy if exists "uploads public read active" on public.uploads;
drop policy if exists "uploads owner insert" on public.uploads;
drop policy if exists "uploads owner update" on public.uploads;
drop policy if exists "uploads owner delete" on public.uploads;
create policy "uploads public read active" on public.uploads for select
  using (expires_at is null or expires_at > now() or (select auth.uid()) = user_id);
create policy "uploads owner insert" on public.uploads for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "uploads owner update" on public.uploads for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "uploads owner delete" on public.uploads for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "categories public read" on public.upload_categories;
drop policy if exists "categories owner insert" on public.upload_categories;
drop policy if exists "categories owner delete" on public.upload_categories;
create policy "categories public read" on public.upload_categories for select using (true);
create policy "categories owner insert" on public.upload_categories for insert to authenticated with check (exists(select 1 from public.uploads u where u.id=upload_id and u.user_id=(select auth.uid())));
create policy "categories owner delete" on public.upload_categories for delete to authenticated using (exists(select 1 from public.uploads u where u.id=upload_id and u.user_id=(select auth.uid())));

drop policy if exists "upload media public read" on public.upload_media;
drop policy if exists "upload media owner insert" on public.upload_media;
drop policy if exists "upload media owner delete" on public.upload_media;
create policy "upload media public read" on public.upload_media for select using (
  exists (select 1 from public.uploads u where u.id=upload_id
    and (u.expires_at is null or u.expires_at > now() or u.user_id=(select auth.uid())))
);
create policy "upload media owner insert" on public.upload_media for insert to authenticated with check (
  exists (select 1 from public.uploads u where u.id=upload_id and u.user_id=(select auth.uid()))
);
create policy "upload media owner delete" on public.upload_media for delete to authenticated using (
  exists (select 1 from public.uploads u where u.id=upload_id and u.user_id=(select auth.uid()))
);

drop policy if exists "likes public read" on public.likes;
drop policy if exists "likes self insert" on public.likes;
drop policy if exists "likes self delete" on public.likes;
create policy "likes public read" on public.likes for select using (true);
create policy "likes self insert" on public.likes for insert to authenticated with check ((select auth.uid())=user_id);
create policy "likes self delete" on public.likes for delete to authenticated using ((select auth.uid())=user_id);

-- Storage buckets (public) with size and type limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', true, 10485760, array['image/*']),
  ('videos', 'videos', true, 52428800, array['video/*'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: authenticated users can upload only into their own UUID folder.
drop policy if exists "photo read" on storage.objects;
drop policy if exists "photo owner insert" on storage.objects;
drop policy if exists "photo owner delete" on storage.objects;
create policy "photo read" on storage.objects for select using (bucket_id='photos');
create policy "photo owner insert" on storage.objects for insert to authenticated with check (bucket_id='photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photo owner delete" on storage.objects for delete to authenticated using (bucket_id='photos' and owner_id = (select auth.uid())::text);

drop policy if exists "video read" on storage.objects;
drop policy if exists "video owner insert" on storage.objects;
drop policy if exists "video owner delete" on storage.objects;
create policy "video read" on storage.objects for select using (bucket_id='videos');
create policy "video owner insert" on storage.objects for insert to authenticated with check (bucket_id='videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "video owner delete" on storage.objects for delete to authenticated using (bucket_id='videos' and owner_id = (select auth.uid())::text);

-- Automatically create a profile for email/password and OAuth signups.
-- Falls back to a generated username when the requested one is missing, invalid or already taken,
-- so a username clash can never make signup fail.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'preferred_username');
  final_username text;
begin
  if wanted is not null
     and wanted ~ '^[A-Za-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles p where p.username = wanted and p.id <> new.id) then
    final_username := wanted;
  else
    final_username := 'wizard_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles(id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
