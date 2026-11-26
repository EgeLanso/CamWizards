create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

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
  camera_price numeric,
  currency text,
  purchased_from text,
  condition text check (condition in ('new','used')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
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

alter table public.profiles enable row level security;
alter table public.cameras enable row level security;
alter table public.lenses enable row level security;
alter table public.uploads enable row level security;
alter table public.upload_categories enable row level security;
alter table public.likes enable row level security;

create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

create policy "cameras public read" on public.cameras for select using (true);
create policy "cameras authenticated insert" on public.cameras for insert to authenticated with check (true);
create policy "cameras authenticated update" on public.cameras for update to authenticated using (true);

create policy "lenses public read" on public.lenses for select using (true);
create policy "lenses authenticated insert" on public.lenses for insert to authenticated with check (true);
create policy "lenses authenticated update" on public.lenses for update to authenticated using (true);

create policy "uploads public read active" on public.uploads for select using (expires_at is null or expires_at > now());
create policy "uploads owner insert" on public.uploads for insert to authenticated with check (auth.uid() = user_id);
create policy "uploads owner update" on public.uploads for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "uploads owner delete" on public.uploads for delete to authenticated using (auth.uid() = user_id);

create policy "categories public read" on public.upload_categories for select using (true);
create policy "categories owner insert" on public.upload_categories for insert to authenticated with check (exists(select 1 from public.uploads u where u.id=upload_id and u.user_id=auth.uid()));
create policy "categories owner delete" on public.upload_categories for delete to authenticated using (exists(select 1 from public.uploads u where u.id=upload_id and u.user_id=auth.uid()));

create policy "likes public read" on public.likes for select using (true);
create policy "likes self insert" on public.likes for insert to authenticated with check (auth.uid()=user_id);
create policy "likes self delete" on public.likes for delete to authenticated using (auth.uid()=user_id);

-- Storage buckets: create these in Supabase Storage as public buckets named photos and videos.
-- Storage policies below allow authenticated users to upload only into their own UUID folder.
create policy "photo read" on storage.objects for select using (bucket_id='photos');
create policy "photo owner insert" on storage.objects for insert to authenticated with check (bucket_id='photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photo owner delete" on storage.objects for delete to authenticated using (bucket_id='photos' and owner_id = auth.uid()::text);

create policy "video read" on storage.objects for select using (bucket_id='videos');
create policy "video owner insert" on storage.objects for insert to authenticated with check (bucket_id='videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "video owner delete" on storage.objects for delete to authenticated using (bucket_id='videos' and owner_id = auth.uid()::text);

-- Automatically create a profile for email/password and OAuth signups.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'preferred_username', 'wizard_' || substr(new.id::text,1,8)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();