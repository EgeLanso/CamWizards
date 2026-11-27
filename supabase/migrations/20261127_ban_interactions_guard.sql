-- Apply after 20261126_community_admin_xp_moderation.sql.
-- Enforce account suspensions even when a client calls Supabase directly.

-- A banned account may remove an existing like, but cannot add a new one.
drop policy if exists "likes self insert" on public.likes;
create policy "likes self insert" on public.likes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.user_bans b
      where b.user_id = (select auth.uid())
        and b.revoked_at is null
        and (b.expires_at is null or b.expires_at > now())
    )
  );

-- Prevent ordinary users from bypassing the 10-day video-renewal flow by
-- directly updating uploads.expires_at through the Supabase Data API.
create or replace function public.guard_video_renewal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated'
     and new.expires_at is distinct from old.expires_at then
    if old.media_type <> 'video' then
      raise exception 'Only video posts can have an expiry date changed';
    end if;

    if exists (
      select 1 from public.user_bans b
      where b.user_id = auth.uid()
        and b.revoked_at is null
        and (b.expires_at is null or b.expires_at > now())
    ) then
      raise exception 'Suspended accounts cannot renew videos';
    end if;

    if new.expires_at is null
       or new.expires_at > greatest(coalesce(old.expires_at, now()), now()) + interval '10 days' then
      raise exception 'A video can only be renewed for up to 10 days at a time';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_video_renewal on public.uploads;
create trigger guard_video_renewal
  before update of expires_at on public.uploads
  for each row execute function public.guard_video_renewal();
