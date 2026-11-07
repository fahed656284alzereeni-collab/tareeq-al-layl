\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;

create schema auth;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid()
returns uuid language sql stable
as $uid$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$uid$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$')
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references auth.users(id) on delete cascade,
  user_two uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint different_participants check (user_one <> user_two),
  constraint ordered_participants check (user_one < user_two),
  constraint unique_direct_conversation unique (user_one,user_two)
);
create index conversations_user_one_idx on public.conversations(user_one);
create index conversations_user_two_idx on public.conversations(user_two);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint message_body_length check (char_length(body) >= 1 and char_length(body) <= 10000)
);
create index messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create index messages_sender_id_idx on public.messages(sender_id);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Authenticated users can discover profiles"
on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id=(select auth.uid()))
with check (id=(select auth.uid()));

create policy "Participants can view conversations"
on public.conversations for select to authenticated
using (user_one=(select auth.uid()) or user_two=(select auth.uid()));
create policy "Users can start direct conversations"
on public.conversations for insert to authenticated
with check (user_one=(select auth.uid()) or user_two=(select auth.uid()));

create policy "Participants can view messages"
on public.messages for select to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id=messages.conversation_id
    and (c.user_one=(select auth.uid()) or c.user_two=(select auth.uid()))
));
create policy "Participants can send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id=messages.conversation_id
      and (c.user_one=(select auth.uid()) or c.user_two=(select auth.uid()))
  )
);
create policy "Recipients can mark messages as read"
on public.messages for update to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id=messages.conversation_id
    and (((c.user_one=(select auth.uid())) and messages.sender_id=c.user_two)
      or ((c.user_two=(select auth.uid())) and messages.sender_id=c.user_one))
))
with check (read_at is not null);

grant select on public.profiles to authenticated;
grant select,insert on public.conversations to authenticated;
grant select,insert,update on public.messages to authenticated;

insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','{}'::jsonb),
('00000000-0000-0000-0000-000000000002','{}'::jsonb),
('00000000-0000-0000-0000-000000000003','{}'::jsonb),
('00000000-0000-0000-0000-000000000004','{}'::jsonb);

insert into public.profiles(id,username,display_name) values
('00000000-0000-0000-0000-000000000001','user_one','User One'),
('00000000-0000-0000-0000-000000000002','user_two','User Two'),
('00000000-0000-0000-0000-000000000003','user_three','User Three'),
('00000000-0000-0000-0000-000000000004','user_four','User Four');

insert into public.conversations(id,user_one,user_two) values
('00000000-0000-0000-0000-000000000101',
 '00000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000002');

insert into public.messages(id,conversation_id,sender_id,body) values
('00000000-0000-0000-0000-000000000201',
 '00000000-0000-0000-0000-000000000101',
 '00000000-0000-0000-0000-000000000001',
 'Legacy message');

-- Mirror the existing Supabase Realtime publication for the migration test.
create publication supabase_realtime;
alter publication supabase_realtime add table public.conversations, public.messages;
