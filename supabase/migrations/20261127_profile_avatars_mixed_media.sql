-- Mixed photo/video galleries and user-uploaded profile avatars.
-- Safe to run more than once.

alter table public.upload_media
  add column if not exists media_type text not null default 'photo';
alter table public.upload_media
  add column if not exists expires_at timestamptz;

alter table public.upload_media
  drop constraint if exists upload_media_media_type_check;
alter table public.upload_media
  add constraint upload_media_media_type_check
  check (media_type in ('photo', 'video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatar owner insert" on storage.objects;
create policy "avatar owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (
      select 1 from public.user_bans b
      where b.user_id = (select auth.uid())
        and b.revoked_at is null
        and (b.expires_at is null or b.expires_at > now())
    )
  );

drop policy if exists "avatar owner delete" on storage.objects;
create policy "avatar owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
