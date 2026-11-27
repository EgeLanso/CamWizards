-- CamWizards private group chats.
-- All access is mediated by authenticated Next.js route handlers using the server-only service role.
-- Do not add client-side SELECT/INSERT policies to these tables.

create table if not exists public.private_chats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.private_chat_members (
  chat_id uuid not null references public.private_chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.private_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.private_chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists private_chat_members_user_idx
  on public.private_chat_members(user_id, created_at desc);
create index if not exists private_chat_messages_chat_created_idx
  on public.private_chat_messages(chat_id, created_at desc);

alter table public.private_chats enable row level security;
alter table public.private_chat_members enable row level security;
alter table public.private_chat_messages enable row level security;

-- No direct anon/authenticated table access. The API validates both account membership
-- and a short-lived signed room-unlock cookie before it reads or writes messages.
revoke all on table public.private_chats from anon, authenticated;
revoke all on table public.private_chat_members from anon, authenticated;
revoke all on table public.private_chat_messages from anon, authenticated;
grant all on table public.private_chats to service_role;
grant all on table public.private_chat_members to service_role;
grant all on table public.private_chat_messages to service_role;
