-- Multi-photo galleries for CamWizards.
-- Safe to run more than once in Supabase SQL Editor.

create table if not exists public.upload_media (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads(id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (upload_id, storage_path)
);

create index if not exists upload_media_upload_order_idx
  on public.upload_media(upload_id, sort_order);

alter table public.upload_media enable row level security;

drop policy if exists "upload media public read" on public.upload_media;
drop policy if exists "upload media owner insert" on public.upload_media;
drop policy if exists "upload media owner delete" on public.upload_media;

create policy "upload media public read" on public.upload_media
  for select using (
    exists (
      select 1 from public.uploads u
      where u.id = upload_id
        and (u.expires_at is null or u.expires_at > now() or u.user_id = (select auth.uid()))
    )
  );

create policy "upload media owner insert" on public.upload_media
  for insert to authenticated with check (
    exists (
      select 1 from public.uploads u
      where u.id = upload_id and u.user_id = (select auth.uid())
    )
  );

create policy "upload media owner delete" on public.upload_media
  for delete to authenticated using (
    exists (
      select 1 from public.uploads u
      where u.id = upload_id and u.user_id = (select auth.uid())
    )
  );

-- Existing uploads remain compatible: pages fall back to uploads.storage_path
-- when no upload_media rows exist. New photo posts add every photo to this table.
