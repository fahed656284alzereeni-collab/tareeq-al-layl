-- Phase 1: Expand the existing Supabase prototype for Mersal.
-- DESIGN / REVIEW MIGRATION ONLY. Do not apply to production until reviewed and tested.
-- Existing conversations/messages tables are extended additively; legacy columns are retained.

begin;

-- Create the non-exposed helper schema before defining any internal functions.
create schema if not exists private;

-- 1) Conversation metadata and normalized membership.
alter table public.conversations
  add column if not exists type text not null default 'direct',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists announcement text,
  add column if not exists group_permissions jsonb not null default '{"editInfo":"admins","addMembers":"admins"}'::jsonb,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_message_at timestamptz;

-- Retire pair-only constraints before allowing group rows with NULL legacy pair fields.
alter table public.conversations
  drop constraint if exists ordered_participants,
  drop constraint if exists different_participants,
  drop constraint if exists unique_direct_conversation,
  drop constraint if exists conversations_type_check;

alter table public.conversations
  alter column user_one drop not null,
  alter column user_two drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_type_check'
  ) then
    alter table public.conversations
      add constraint conversations_type_check check (type in ('direct','group'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_type_participants_check'
  ) then
    alter table public.conversations
      add constraint conversations_type_participants_check check (
        (type = 'direct' and user_one is not null and user_two is not null and user_one < user_two)
        or
        (type = 'group' and user_one is null and user_two is null)
      );
  end if;
end;
$$;

create unique index if not exists conversations_unique_direct_pair
  on public.conversations (user_one, user_two)
  where type = 'direct' and user_one is not null and user_two is not null;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  is_hidden boolean not null default false,
  cleared_at timestamptz,
  primary key (conversation_id,user_id)
);

create index if not exists conversation_members_user_active_idx
  on public.conversation_members(user_id, conversation_id)
  where left_at is null;

-- Backfill existing direct conversations into normalized membership.
insert into public.conversation_members(conversation_id,user_id,role)
select c.id, u.user_id, case when u.user_id = c.created_by then 'owner' else 'member' end
from public.conversations c
cross join lateral (values (c.user_one),(c.user_two)) as u(user_id)
where u.user_id is not null
on conflict (conversation_id,user_id) do nothing;

-- 2) Extend messages without removing the legacy body/read_at fields.
alter table public.messages
  add column if not exists attachment jsonb,
  add column if not exists reply_to uuid references public.messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_for_everyone boolean not null default false;

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id,user_id)
);

create table if not exists public.message_user_visibility (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id,user_id)
);

-- Permit attachment-only messages while retaining the text length limit.
alter table public.messages drop constraint if exists message_body_length;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'message_body_or_attachment_length'
  ) then
    alter table public.messages
      add constraint message_body_or_attachment_length
      check (char_length(body) <= 4000 and (char_length(body) >= 1 or attachment is not null));
  else
    alter table public.messages drop constraint message_body_or_attachment_length;
    alter table public.messages
      add constraint message_body_or_attachment_length
      check (char_length(body) <= 4000 and (char_length(body) >= 1 or attachment is not null));
  end if;
end;
$$;

-- Validate message metadata on every insert, including inserts that bypass
-- the application server and use the Supabase Data API directly.
create or replace function private.validate_message_insert()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
declare v_reply_conversation uuid;
begin
  if char_length(coalesce(new.body,''))>4000 then
    raise exception 'Message body is too long' using errcode='22023';
  end if;
  if char_length(coalesce(new.body,''))=0 and new.attachment is null then
    raise exception 'Message body or attachment is required' using errcode='22023';
  end if;
  if new.reply_to is not null then
    select conversation_id into v_reply_conversation
      from public.messages where id=new.reply_to and not deleted_for_everyone;
    if not found or v_reply_conversation<>new.conversation_id then
      raise exception 'Reply target is not in this conversation' using errcode='22023';
    end if;
  end if;
  if new.attachment is not null then
    if jsonb_typeof(new.attachment)<>'object'
       or coalesce(new.attachment->>'type','')=''
       or coalesce(new.attachment->>'name','')=''
       or coalesce((new.attachment->>'size')::bigint,0)<1
       or coalesce((new.attachment->>'size')::bigint,0)>52428800
       or coalesce(new.attachment->>'storagePath','') not like
          ('conversations/'||new.conversation_id::text||'/'||new.sender_id::text||'/%') then
      raise exception 'Invalid attachment metadata or storage path' using errcode='22023';
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function private.validate_message_insert() from public,anon,authenticated;
drop trigger if exists messages_validate_insert on public.messages;
create trigger messages_validate_insert
before insert on public.messages
for each row execute function private.validate_message_insert();

-- Automatically create one receipt per other active member and keep the
-- conversation's last-message timestamp current in the same transaction.
create schema if not exists private;

-- Profile fields used by the existing account screens.
alter table public.profiles
  add column if not exists bio text not null default '';

do $profile$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass and conname='profiles_bio_length'
  ) then
    alter table public.profiles
      add constraint profiles_bio_length check (char_length(bio) <= 200);
  end if;
end;
$profile$;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

-- Users may edit only their own public profile fields. updated_at is trigger-managed.
revoke update on public.profiles from authenticated;
grant update (username, display_name, bio, avatar_url) on public.profiles to authenticated;

create or replace function private.touch_profile_updated_at()
returns trigger language plpgsql set search_path = ''
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

revoke all on function private.touch_profile_updated_at() from public,anon,authenticated;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_profile_updated_at();

revoke all on schema private from public;

create or replace function private.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.message_receipts(message_id,user_id)
  select new.id, cm.user_id
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id
    and cm.user_id <> new.sender_id
    and cm.left_at is null
  on conflict (message_id,user_id) do nothing;

  update public.conversation_members
  set is_hidden = false, cleared_at = null
  where conversation_id = new.conversation_id and left_at is null;

  update public.conversations
  set last_message_at = greatest(
        coalesce(last_message_at, '-infinity'::timestamptz),
        coalesce(new.created_at, now())
      ),
      updated_at = greatest(updated_at, coalesce(new.created_at, now()))
  where id = new.conversation_id;

  return new;
end;
$$;

revoke all on function private.on_message_insert() from public, anon, authenticated;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert
after insert on public.messages
for each row execute function private.on_message_insert();

-- 3) Social graph and safety controls.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (sender_id <> recipient_id)
);
create unique index if not exists friend_requests_one_pending_pair
  on public.friend_requests(sender_id,recipient_id) where status='pending';

create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,friend_id),
  constraint friendships_not_self check(user_id <> friend_id)
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  constraint user_blocks_not_self check(blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'new' check(status in ('new','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- 4) Scheduled messages and user notifications.
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  attachment jsonb,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check(status in ('pending','sent','cancelled','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages(scheduled_for) where status='pending';

do $scheduled$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.scheduled_messages'::regclass and conname='scheduled_message_content_check') then
    alter table public.scheduled_messages add constraint scheduled_message_content_check
      check (char_length(body) <= 4000 and (char_length(body) > 0 or attachment is not null));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.scheduled_messages'::regclass and conname='scheduled_message_after_creation_check') then
    alter table public.scheduled_messages add constraint scheduled_message_after_creation_check
      check (scheduled_for > created_at);
  end if;
end;
$scheduled$;

create or replace function private.validate_scheduled_message_insert()
returns trigger language plpgsql security definer set search_path = ''
as $fn$
begin
  if char_length(coalesce(new.body,''))>4000
     or (char_length(coalesce(new.body,''))=0 and new.attachment is null) then
    raise exception 'Invalid scheduled message content' using errcode='22023';
  end if;
  if new.attachment is not null then
    if jsonb_typeof(new.attachment)<>'object'
       or coalesce(new.attachment->>'type','')=''
       or coalesce(new.attachment->>'name','')=''
       or coalesce((new.attachment->>'size')::bigint,0)<1
       or coalesce((new.attachment->>'size')::bigint,0)>52428800
       or coalesce(new.attachment->>'storagePath','') not like
          ('conversations/'||new.conversation_id::text||'/'||new.sender_id::text||'/%') then
      raise exception 'Invalid scheduled attachment metadata or storage path' using errcode='22023';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function private.validate_scheduled_message_insert() from public,anon,authenticated;
drop trigger if exists scheduled_messages_validate_insert on public.scheduled_messages;
create trigger scheduled_messages_validate_insert
before insert on public.scheduled_messages
for each row execute function private.validate_scheduled_message_insert();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_recent_idx
  on public.notifications(user_id,created_at desc);

-- 5) Authorization helper. SECURITY DEFINER avoids recursive RLS evaluation
-- when membership policies query conversation_members.
create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and cm.left_at is null
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public,anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;
create or replace function public.is_direct_conversation_blocked(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_members me
      on me.conversation_id=c.id and me.user_id=auth.uid() and me.left_at is null
    join public.conversation_members other_member
      on other_member.conversation_id=c.id and other_member.user_id<>auth.uid() and other_member.left_at is null
    join public.user_blocks b
      on (b.blocker_id=auth.uid() and b.blocked_id=other_member.user_id)
      or (b.blocker_id=other_member.user_id and b.blocked_id=auth.uid())
    where c.id=p_conversation_id and c.type='direct'
  );
$fn$;
revoke all on function public.is_direct_conversation_blocked(uuid) from public,anon;
grant execute on function public.is_direct_conversation_blocked(uuid) to authenticated;

-- 6) Enable RLS on every newly exposed table.
alter table public.conversation_members enable row level security;
alter table public.message_receipts enable row level security;
alter table public.message_user_visibility enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.notifications enable row level security;

-- Membership rows are visible only to active members of that conversation.
drop policy if exists "Members can view their conversation memberships" on public.conversation_members;
create policy "Members can view their conversation memberships"
on public.conversation_members for select to authenticated
using (public.is_conversation_member(conversation_id));

-- A user may join only as themselves through a trusted creation flow.
-- Direct client inserts are intentionally not granted here; server/RPC will manage membership.
drop policy if exists "Users can view receipts in their conversations" on public.message_receipts;
create policy "Users can view receipts in their conversations"
on public.message_receipts for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Recipients can update own receipts" on public.message_receipts;

drop policy if exists "Users can view own message visibility" on public.message_user_visibility;
create policy "Users can view own message visibility"
on public.message_user_visibility for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can manage own message visibility" on public.message_user_visibility;
create policy "Users can manage own message visibility"
on public.message_user_visibility for all to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.messages m where m.id = message_id and public.is_conversation_member(m.conversation_id))
)
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.messages m where m.id = message_id and public.is_conversation_member(m.conversation_id))
);

drop policy if exists "Users can view own sent or received friend requests" on public.friend_requests;
create policy "Users can view own sent or received friend requests"
on public.friend_requests for select to authenticated
using ((sender_id = (select auth.uid())) or (recipient_id = (select auth.uid())));

drop policy if exists "Users can send friend requests as themselves" on public.friend_requests;

drop policy if exists "Recipients can respond to friend requests" on public.friend_requests;

drop policy if exists "Users can view their friendships" on public.friendships;
create policy "Users can view their friendships"
on public.friendships for select to authenticated
using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

drop policy if exists "Users can remove their own friendship edge" on public.friendships;

drop policy if exists "Users can view blocks they created" on public.user_blocks;
create policy "Users can view blocks they created"
on public.user_blocks for select to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "Users can create their own blocks" on public.user_blocks;
create policy "Users can create their own blocks"
on public.user_blocks for insert to authenticated
with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id);

drop policy if exists "Users can remove their own blocks" on public.user_blocks;
create policy "Users can remove their own blocks"
on public.user_blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

drop policy if exists "Users can create reports as themselves" on public.user_reports;
create policy "Users can create reports as themselves"
on public.user_reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

drop policy if exists "Users can view reports they submitted" on public.user_reports;
create policy "Users can view reports they submitted"
on public.user_reports for select to authenticated
using (reporter_id = (select auth.uid()));

drop policy if exists "Users can view their scheduled messages" on public.scheduled_messages;
create policy "Users can view their scheduled messages"
on public.scheduled_messages for select to authenticated
using (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

drop policy if exists "Users can schedule messages as themselves" on public.scheduled_messages;
create policy "Users can schedule messages as themselves"
on public.scheduled_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_conversation_member(conversation_id)
  and scheduled_for > now()
  and char_length(body) <= 4000
  and (char_length(body) > 0 or attachment is not null)
  and not public.is_direct_conversation_blocked(conversation_id)
);

drop policy if exists "Users can cancel their pending scheduled messages" on public.scheduled_messages;

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));


-- Private transactional APIs: membership is never client-writable.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create unique index if not exists friend_requests_one_pending_unordered_pair
  on public.friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status = 'pending';

create or replace function private.send_friend_request(p_recipient_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_request_id uuid;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_recipient_id is null or p_recipient_id = v_me then
    raise exception 'Invalid recipient' using errcode='22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_recipient_id) then
    raise exception 'User not found' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    least(v_me,p_recipient_id)::text || ':' || greatest(v_me,p_recipient_id)::text, 0
  ));
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_me and b.blocked_id=p_recipient_id)
       or (b.blocker_id=p_recipient_id and b.blocked_id=v_me)) then
    raise exception 'Friend request is unavailable' using errcode='42501';
  end if;
  if exists (select 1 from public.friendships f
    where f.user_id=v_me and f.friend_id=p_recipient_id) then
    raise exception 'Already friends' using errcode='23505';
  end if;
  if exists (select 1 from public.friend_requests r
    where r.status='pending'
      and ((r.sender_id=v_me and r.recipient_id=p_recipient_id)
        or (r.sender_id=p_recipient_id and r.recipient_id=v_me))) then
    raise exception 'A pending request already exists' using errcode='23505';
  end if;
  insert into public.friend_requests(sender_id,recipient_id)
    values (v_me,p_recipient_id) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function private.remove_friendship(p_friend_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_friend_id is null or p_friend_id = v_me then
    raise exception 'Invalid friend' using errcode='22023';
  end if;
  delete from public.friendships
    where (user_id=v_me and friend_id=p_friend_id)
       or (user_id=p_friend_id and friend_id=v_me);
end;
$$;

create or replace function private.create_direct_conversation(p_other_user uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_id uuid;
begin
  if v_me is null or p_other_user is null or p_other_user = v_me then
    raise exception 'Invalid conversation participants' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_other_user) then
    raise exception 'User not found' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_me and b.blocked_id=p_other_user)
       or (b.blocker_id=p_other_user and b.blocked_id=v_me)) then
    raise exception 'Conversation is unavailable' using errcode = '42501';
  end if;
  v_low := least(v_me,p_other_user);
  v_high := greatest(v_me,p_other_user);
  perform pg_advisory_xact_lock(hashtextextended(v_low::text || ':' || v_high::text,0));
  select id into v_id from public.conversations
    where type='direct' and user_one=v_low and user_two=v_high limit 1;
  if v_id is null then
    insert into public.conversations(type,user_one,user_two,created_by)
    values ('direct',v_low,v_high,v_me) returning id into v_id;
  end if;
  insert into public.conversation_members(conversation_id,user_id,role)
  values (v_id,v_low,case when v_low=v_me then 'owner' else 'member' end),
         (v_id,v_high,case when v_high=v_me then 'owner' else 'member' end)
  on conflict (conversation_id,user_id) do nothing;
  return v_id;
end;
$$;

create or replace function private.create_group_conversation(p_title text,p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_members uuid[];
  v_count integer;
  v_id uuid;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if coalesce(cardinality(p_member_ids),0)<1 or cardinality(p_member_ids)>49 then
    raise exception 'Invalid group member count' using errcode='22023';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null or char_length(btrim(coalesce(p_title,'')))>50 then
    raise exception 'Invalid group title' using errcode='22023';
  end if;
  select array_agg(x order by x) into v_members
    from (select distinct unnest(p_member_ids || array[v_me]) as x) d;
  select count(*) into v_count from auth.users u where u.id=any(v_members);
  if v_count<>cardinality(v_members) then raise exception 'Unknown group member' using errcode='22023'; end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_me and b.blocked_id=any(v_members))
       or (b.blocked_id=v_me and b.blocker_id=any(v_members))) then
    raise exception 'A selected member is unavailable' using errcode='42501';
  end if;
  insert into public.conversations(type,title,created_by)
    values ('group',nullif(btrim(p_title),''),v_me) returning id into v_id;
  insert into public.conversation_members(conversation_id,user_id,role)
    select v_id,user_id,case when user_id=v_me then 'owner' else 'member' end from unnest(v_members) as members(user_id);
  return v_id;
end;
$$;

create or replace function private.add_group_members(p_conversation_id uuid,p_member_ids uuid[])
returns integer language plpgsql security definer set search_path = ''
as $fn$
declare
  v_me uuid := auth.uid(); v_type text; v_permissions jsonb; v_role text;
  v_ids uuid[]; v_new uuid[]; v_count integer;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if coalesce(cardinality(p_member_ids),0)<1 or cardinality(p_member_ids)>49 then
    raise exception 'Invalid group member count' using errcode='22023';
  end if;
  select c.type,c.group_permissions,cm.role into v_type,v_permissions,v_role
  from public.conversations c join public.conversation_members cm
    on cm.conversation_id=c.id and cm.user_id=v_me and cm.left_at is null
  where c.id=p_conversation_id for update of c;
  if not found or v_type<>'group' then raise exception 'Group not found or access denied' using errcode='42501'; end if;
  if coalesce(v_permissions->>'addMembers','admins')<>'members' and v_role not in ('owner','moderator') then
    raise exception 'Only group admins may add members' using errcode='42501';
  end if;
  select array_agg(x order by x) into v_ids from (select distinct unnest(p_member_ids) x) q
    where x is not null and x<>v_me;
  if coalesce(cardinality(v_ids),0)=0 then raise exception 'No new members selected' using errcode='22023'; end if;
  select array_agg(x order by x) into v_new from unnest(v_ids) as requested(x)
    where not exists (select 1 from public.conversation_members cm
      where cm.conversation_id=p_conversation_id and cm.user_id=x and cm.left_at is null);
  if coalesce(cardinality(v_new),0)=0 then raise exception 'All selected users are already members' using errcode='22023'; end if;
  if exists (select 1 from unnest(v_new) as selected(user_id) where not exists(select 1 from auth.users u where u.id=selected.user_id)) then
    raise exception 'Unknown group member' using errcode='22023';
  end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_me and b.blocked_id=any(v_new))
       or (b.blocked_id=v_me and b.blocker_id=any(v_new))) then
    raise exception 'A selected member is unavailable' using errcode='42501';
  end if;
  select count(*) into v_count from public.conversation_members cm
    where cm.conversation_id=p_conversation_id and cm.left_at is null;
  if v_count+cardinality(v_new)>50 then raise exception 'Group member limit reached' using errcode='22023'; end if;
  insert into public.conversation_members(conversation_id,user_id,role,joined_at,left_at,is_hidden,cleared_at)
    select p_conversation_id,x,'member',now(),null,false,null from unnest(v_new) x
    on conflict (conversation_id,user_id) do update
      set role='member',joined_at=now(),left_at=null,is_hidden=false,cleared_at=null;
  update public.conversations set updated_at=now() where id=p_conversation_id;
  return cardinality(v_new);
end;
$fn$;

create or replace function private.remove_group_member(p_conversation_id uuid,p_target_user uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_actor_role text; v_target_role text;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select c.type,actor.role into v_type,v_actor_role
  from public.conversations c join public.conversation_members actor
    on actor.conversation_id=c.id and actor.user_id=v_me and actor.left_at is null
  where c.id=p_conversation_id for update of c;
  if not found or v_type<>'group' or v_actor_role not in ('owner','moderator') then
    raise exception 'Not authorized to manage this group' using errcode='42501';
  end if;
  select role into v_target_role from public.conversation_members
    where conversation_id=p_conversation_id and user_id=p_target_user and left_at is null;
  if not found then raise exception 'Member not found' using errcode='P0002'; end if;
  if v_target_role='owner' then raise exception 'Cannot remove group owner' using errcode='42501'; end if;
  update public.conversation_members set left_at=now()
    where conversation_id=p_conversation_id and user_id=p_target_user and left_at is null;
  update public.conversations set updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.leave_group(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_creator uuid;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select type,created_by into v_type,v_creator from public.conversations where id=p_conversation_id for update;
  if not found or v_type<>'group' then raise exception 'Group not found' using errcode='P0002'; end if;
  if v_creator=v_me then raise exception 'Group creator cannot leave; delete the group instead' using errcode='42501'; end if;
  update public.conversation_members set left_at=now()
    where conversation_id=p_conversation_id and user_id=v_me and left_at is null;
  if not found then raise exception 'You are not an active group member' using errcode='42501'; end if;
  update public.conversations set updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.rename_group(p_conversation_id uuid,p_title text)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_permissions jsonb; v_role text; v_title text;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  v_title:=btrim(coalesce(p_title,''));
  if char_length(v_title)<1 or char_length(v_title)>50 then raise exception 'Invalid group title' using errcode='22023'; end if;
  select c.type,c.group_permissions,cm.role into v_type,v_permissions,v_role
  from public.conversations c join public.conversation_members cm
    on cm.conversation_id=c.id and cm.user_id=v_me and cm.left_at is null
  where c.id=p_conversation_id;
  if not found or v_type<>'group' then raise exception 'Group not found or access denied' using errcode='42501'; end if;
  if coalesce(v_permissions->>'editInfo','admins')<>'members' and v_role not in ('owner','moderator') then
    raise exception 'Only group admins may edit group information' using errcode='42501';
  end if;
  update public.conversations set title=v_title,updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.update_group_details(p_conversation_id uuid,p_description text,p_announcement text)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_permissions jsonb; v_role text;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if char_length(coalesce(p_description,''))>500 or char_length(coalesce(p_announcement,''))>500 then
    raise exception 'Group details are too long' using errcode='22023';
  end if;
  select c.type,c.group_permissions,cm.role into v_type,v_permissions,v_role
  from public.conversations c join public.conversation_members cm
    on cm.conversation_id=c.id and cm.user_id=v_me and cm.left_at is null
  where c.id=p_conversation_id;
  if not found or v_type<>'group' then raise exception 'Group not found or access denied' using errcode='42501'; end if;
  if coalesce(v_permissions->>'editInfo','admins')<>'members' and v_role not in ('owner','moderator') then
    raise exception 'Only group admins may edit group information' using errcode='42501';
  end if;
  update public.conversations set description=coalesce(p_description,''),
    announcement=coalesce(p_announcement,''),updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.update_group_permissions(p_conversation_id uuid,p_edit_info text,p_add_members text)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_role text;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_edit_info is null or p_add_members is null or p_edit_info not in ('admins','members') or p_add_members not in ('admins','members') then
    raise exception 'Invalid group permissions' using errcode='22023';
  end if;
  select c.type,cm.role into v_type,v_role
  from public.conversations c join public.conversation_members cm
    on cm.conversation_id=c.id and cm.user_id=v_me and cm.left_at is null
  where c.id=p_conversation_id;
  if not found or v_type<>'group' or v_role not in ('owner','moderator') then
    raise exception 'Only group admins may change permissions' using errcode='42501';
  end if;
  update public.conversations set group_permissions=jsonb_build_object(
    'editInfo',p_edit_info,'addMembers',p_add_members),updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.set_group_moderator(p_conversation_id uuid,p_target_user uuid,p_make_moderator boolean)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_creator uuid; v_target_role text;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select type,created_by into v_type,v_creator from public.conversations where id=p_conversation_id for update;
  if not found or v_type<>'group' or v_creator<>v_me then
    raise exception 'Only the group creator may appoint moderators' using errcode='42501';
  end if;
  select role into v_target_role from public.conversation_members
    where conversation_id=p_conversation_id and user_id=p_target_user and left_at is null;
  if not found or v_target_role='owner' then raise exception 'Invalid moderator target' using errcode='22023'; end if;
  update public.conversation_members set role=case when p_make_moderator then 'moderator' else 'member' end
    where conversation_id=p_conversation_id and user_id=p_target_user and left_at is null;
  update public.conversations set updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.delete_group(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text; v_creator uuid;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select type,created_by into v_type,v_creator from public.conversations where id=p_conversation_id for update;
  if not found or v_type<>'group' or v_creator<>v_me then
    raise exception 'Only the group creator may delete this group' using errcode='42501';
  end if;
  delete from public.conversations where id=p_conversation_id;
end;
$fn$;

create or replace function private.hide_conversation_for_me(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.conversation_members set is_hidden=true
    where conversation_id=p_conversation_id and user_id=v_me and left_at is null;
  if not found then raise exception 'Active conversation membership not found' using errcode='42501'; end if;
end;
$fn$;

create or replace function private.clear_conversation_for_me(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.conversation_members set cleared_at=now()
    where conversation_id=p_conversation_id and user_id=v_me and left_at is null;
  if not found then raise exception 'Active conversation membership not found' using errcode='42501'; end if;
  insert into public.message_user_visibility(message_id,user_id)
    select m.id,v_me from public.messages m
    where m.conversation_id=p_conversation_id
    on conflict (message_id,user_id) do nothing;
end;
$fn$;

create or replace function private.clear_conversation_for_everyone(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists (select 1 from public.conversation_members cm
    where cm.conversation_id=p_conversation_id and cm.user_id=v_me and cm.left_at is null) then
    raise exception 'Active conversation membership not found' using errcode='42501';
  end if;
  delete from public.messages where conversation_id=p_conversation_id;
  update public.conversation_members set is_hidden=false,cleared_at=null
    where conversation_id=p_conversation_id and left_at is null;
  update public.conversations set last_message_at=null,updated_at=now() where id=p_conversation_id;
end;
$fn$;

create or replace function private.delete_direct_conversation(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_type text;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select c.type into v_type
    from public.conversations c join public.conversation_members cm
      on cm.conversation_id=c.id and cm.user_id=v_me and cm.left_at is null
    where c.id=p_conversation_id for update of c;
  if not found or v_type<>'direct' then raise exception 'Direct conversation not found or access denied' using errcode='42501'; end if;
  delete from public.conversations where id=p_conversation_id;
end;
$fn$;

create or replace function private.edit_message(p_message_id uuid,p_body text)
returns public.messages language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_conversation_id uuid; v_message public.messages%rowtype;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_body is null or char_length(btrim(p_body))<1 or char_length(p_body)>4000 then
    raise exception 'Invalid message body' using errcode='22023';
  end if;
  select m.conversation_id into v_conversation_id
    from public.messages m join public.conversation_members cm
      on cm.conversation_id=m.conversation_id and cm.user_id=v_me and cm.left_at is null
    where m.id=p_message_id and m.sender_id=v_me and not m.deleted_for_everyone;
  if not found then raise exception 'Message not found or access denied' using errcode='42501'; end if;
  update public.messages set body=btrim(p_body),edited_at=now()
    where id=p_message_id returning * into v_message;
  update public.conversations set updated_at=now() where id=v_conversation_id;
  return v_message;
end;
$fn$;

create or replace function private.delete_message_for_everyone(p_message_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_conversation_id uuid;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select m.conversation_id into v_conversation_id
    from public.messages m join public.conversation_members cm
      on cm.conversation_id=m.conversation_id and cm.user_id=v_me and cm.left_at is null
    where m.id=p_message_id and m.sender_id=v_me;
  if not found then raise exception 'Message not found or access denied' using errcode='42501'; end if;
  delete from public.messages where id=p_message_id;
  update public.conversations set
    last_message_at=(select max(m.created_at) from public.messages m where m.conversation_id=v_conversation_id),
    updated_at=now()
    where id=v_conversation_id;
  return v_conversation_id;
end;
$fn$;

create or replace function private.mark_message_delivered(p_message_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.message_receipts r set delivered_at=coalesce(r.delivered_at,now())
    from public.messages m
    join public.conversation_members cm on cm.conversation_id=m.conversation_id
      and cm.user_id=v_me and cm.left_at is null
    where r.message_id=p_message_id and r.user_id=v_me
      and m.id=r.message_id and m.sender_id<>v_me;
  if not found then raise exception 'Message receipt not found' using errcode='P0002'; end if;
end;
$fn$;

create or replace function private.mark_message_read(p_message_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.message_receipts r
    set delivered_at=coalesce(r.delivered_at,now()),read_at=coalesce(r.read_at,now())
    from public.messages m
    join public.conversation_members cm on cm.conversation_id=m.conversation_id
      and cm.user_id=v_me and cm.left_at is null
    where r.message_id=p_message_id and r.user_id=v_me
      and m.id=r.message_id and m.sender_id<>v_me;
  if not found then raise exception 'Message receipt not found' using errcode='P0002'; end if;
end;
$fn$;

create or replace function private.save_video_duration(p_message_id uuid,p_duration_seconds integer)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid(); v_attachment jsonb;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_duration_seconds is null or p_duration_seconds<1 or p_duration_seconds>86400 then
    raise exception 'Invalid video duration' using errcode='22023';
  end if;
  select m.attachment into v_attachment
    from public.messages m join public.conversation_members cm
      on cm.conversation_id=m.conversation_id and cm.user_id=v_me and cm.left_at is null
    where m.id=p_message_id and m.sender_id=v_me;
  if not found or coalesce(v_attachment->>'type','') not like 'video/%' then
    raise exception 'Video message not found or access denied' using errcode='42501';
  end if;
  update public.messages
    set attachment=jsonb_set(v_attachment,'{durationSeconds}',to_jsonb(p_duration_seconds),true)
    where id=p_message_id;
end;
$fn$;

create or replace function private.cancel_scheduled_message(p_scheduled_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.scheduled_messages set status='cancelled'
    where id=p_scheduled_id and sender_id=v_me and status='pending' and scheduled_for>now();
  if not found then raise exception 'Pending scheduled message not found or no longer cancellable' using errcode='P0002'; end if;
end;
$fn$;

create or replace function private.cancel_friend_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.friend_requests
    set status='cancelled',responded_at=now()
    where id=p_request_id and sender_id=v_me and status='pending';
  if not found then raise exception 'Pending outgoing request not found' using errcode='P0002'; end if;
end;
$$;

create or replace function private.accept_friend_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid(); v_sender uuid;
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.friend_requests set status='accepted',responded_at=now()
    where id=p_request_id and recipient_id=v_me and status='pending'
    returning sender_id into v_sender;
  if v_sender is null then raise exception 'Pending request not found' using errcode='P0002'; end if;
  if exists (select 1 from public.user_blocks b
    where (b.blocker_id=v_me and b.blocked_id=v_sender)
       or (b.blocker_id=v_sender and b.blocked_id=v_me)) then
    raise exception 'Friendship is unavailable' using errcode='42501';
  end if;
  insert into public.friendships(user_id,friend_id)
    values (v_me,v_sender),(v_sender,v_me) on conflict do nothing;
end;
$$;

revoke all on function private.send_friend_request(uuid) from public,anon;
revoke all on function private.remove_friendship(uuid) from public,anon;
revoke all on function private.create_direct_conversation(uuid) from public,anon;
revoke all on function private.create_group_conversation(text,uuid[]) from public,anon;
create or replace function private.decline_friend_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required' using errcode='28000'; end if;
  update public.friend_requests set status='declined',responded_at=now()
    where id=p_request_id and recipient_id=v_me and status='pending';
  if not found then raise exception 'Pending request not found' using errcode='P0002'; end if;
end;
$$;

revoke all on function private.create_direct_conversation(uuid) from public,anon;
revoke all on function private.create_group_conversation(text,uuid[]) from public,anon;
revoke all on function private.cancel_friend_request(uuid) from public,anon;
revoke all on function private.accept_friend_request(uuid) from public,anon;
revoke all on function private.decline_friend_request(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.send_friend_request(uuid) to authenticated;
grant execute on function private.remove_friendship(uuid) to authenticated;
grant execute on function private.create_direct_conversation(uuid) to authenticated;
grant execute on function private.create_group_conversation(text,uuid[]) to authenticated;
grant execute on function private.cancel_friend_request(uuid) to authenticated;
grant execute on function private.accept_friend_request(uuid) to authenticated;
grant execute on function private.decline_friend_request(uuid) to authenticated;
revoke all on function private.add_group_members(uuid,uuid[]) from public,anon;
revoke all on function private.remove_group_member(uuid,uuid) from public,anon;
revoke all on function private.leave_group(uuid) from public,anon;
revoke all on function private.rename_group(uuid,text) from public,anon;
revoke all on function private.update_group_details(uuid,text,text) from public,anon;
revoke all on function private.update_group_permissions(uuid,text,text) from public,anon;
revoke all on function private.set_group_moderator(uuid,uuid,boolean) from public,anon;
revoke all on function private.delete_group(uuid) from public,anon;
grant execute on function private.add_group_members(uuid,uuid[]) to authenticated;
grant execute on function private.remove_group_member(uuid,uuid) to authenticated;
grant execute on function private.leave_group(uuid) to authenticated;
grant execute on function private.rename_group(uuid,text) to authenticated;
grant execute on function private.update_group_details(uuid,text,text) to authenticated;
grant execute on function private.update_group_permissions(uuid,text,text) to authenticated;
grant execute on function private.set_group_moderator(uuid,uuid,boolean) to authenticated;
grant execute on function private.delete_group(uuid) to authenticated;
revoke all on function private.hide_conversation_for_me(uuid) from public,anon;
revoke all on function private.clear_conversation_for_me(uuid) from public,anon;
revoke all on function private.clear_conversation_for_everyone(uuid) from public,anon;
revoke all on function private.delete_direct_conversation(uuid) from public,anon;
revoke all on function private.edit_message(uuid,text) from public,anon;
revoke all on function private.delete_message_for_everyone(uuid) from public,anon;
revoke all on function private.mark_message_delivered(uuid) from public,anon;
revoke all on function private.mark_message_read(uuid) from public,anon;
revoke all on function private.save_video_duration(uuid,integer) from public,anon;
revoke all on function private.cancel_scheduled_message(uuid) from public,anon;
grant execute on function private.hide_conversation_for_me(uuid) to authenticated;
grant execute on function private.clear_conversation_for_me(uuid) to authenticated;
grant execute on function private.clear_conversation_for_everyone(uuid) to authenticated;
grant execute on function private.delete_direct_conversation(uuid) to authenticated;
grant execute on function private.edit_message(uuid,text) to authenticated;
grant execute on function private.delete_message_for_everyone(uuid) to authenticated;
grant execute on function private.mark_message_delivered(uuid) to authenticated;
grant execute on function private.mark_message_read(uuid) to authenticated;
grant execute on function private.save_video_duration(uuid,integer) to authenticated;
grant execute on function private.cancel_scheduled_message(uuid) to authenticated;

-- Public, invoker-rights entry points for the authenticated Data API.
-- The privileged work remains isolated in the private SECURITY DEFINER routines.
create or replace function public.send_friend_request(p_recipient_id uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.send_friend_request(p_recipient_id); $$;

create or replace function public.remove_friendship(p_friend_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.remove_friendship(p_friend_id); $$;

create or replace function public.create_direct_conversation(p_other_user uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_direct_conversation(p_other_user); $$;

create or replace function public.create_group_conversation(p_title text,p_member_ids uuid[])
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_group_conversation(p_title,p_member_ids); $$;

create or replace function public.add_group_members(p_conversation_id uuid,p_member_ids uuid[])
returns integer language sql security invoker set search_path = ''
as $fn$ select private.add_group_members(p_conversation_id,p_member_ids); $fn$;

create or replace function public.remove_group_member(p_conversation_id uuid,p_target_user uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.remove_group_member(p_conversation_id,p_target_user); $fn$;

create or replace function public.leave_group(p_conversation_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.leave_group(p_conversation_id); $fn$;

create or replace function public.rename_group(p_conversation_id uuid,p_title text)
returns void language sql security invoker set search_path = ''
as $fn$ select private.rename_group(p_conversation_id,p_title); $fn$;

create or replace function public.update_group_details(p_conversation_id uuid,p_description text,p_announcement text)
returns void language sql security invoker set search_path = ''
as $fn$ select private.update_group_details(p_conversation_id,p_description,p_announcement); $fn$;

create or replace function public.update_group_permissions(p_conversation_id uuid,p_edit_info text,p_add_members text)
returns void language sql security invoker set search_path = ''
as $fn$ select private.update_group_permissions(p_conversation_id,p_edit_info,p_add_members); $fn$;

create or replace function public.set_group_moderator(p_conversation_id uuid,p_target_user uuid,p_make_moderator boolean)
returns void language sql security invoker set search_path = ''
as $fn$ select private.set_group_moderator(p_conversation_id,p_target_user,p_make_moderator); $fn$;

create or replace function public.delete_group(p_conversation_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.delete_group(p_conversation_id); $fn$;

create or replace function public.hide_conversation_for_me(p_conversation_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.hide_conversation_for_me(p_conversation_id); $fn$;

create or replace function public.clear_conversation_for_me(p_conversation_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.clear_conversation_for_me(p_conversation_id); $fn$;

create or replace function public.clear_conversation_for_everyone(p_conversation_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.clear_conversation_for_everyone(p_conversation_id); $fn$;

create or replace function public.delete_direct_conversation(p_conversation_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.delete_direct_conversation(p_conversation_id); $fn$;

create or replace function public.edit_message(p_message_id uuid,p_body text)
returns public.messages language sql security invoker set search_path = ''
as $fn$ select private.edit_message(p_message_id,p_body); $fn$;

create or replace function public.delete_message_for_everyone(p_message_id uuid)
returns uuid language sql security invoker set search_path = ''
as $fn$ select private.delete_message_for_everyone(p_message_id); $fn$;

create or replace function public.mark_message_delivered(p_message_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.mark_message_delivered(p_message_id); $fn$;

create or replace function public.mark_message_read(p_message_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.mark_message_read(p_message_id); $fn$;

create or replace function public.save_video_duration(p_message_id uuid,p_duration_seconds integer)
returns void language sql security invoker set search_path = ''
as $fn$ select private.save_video_duration(p_message_id,p_duration_seconds); $fn$;

create or replace function public.cancel_scheduled_message(p_scheduled_id uuid)
returns void language sql security invoker set search_path = ''
as $fn$ select private.cancel_scheduled_message(p_scheduled_id); $fn$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.cancel_friend_request(p_request_id); $$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.accept_friend_request(p_request_id); $$;

create or replace function public.decline_friend_request(p_request_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.decline_friend_request(p_request_id); $$;

revoke all on function public.send_friend_request(uuid) from public,anon;
revoke all on function public.remove_friendship(uuid) from public,anon;
revoke all on function public.create_direct_conversation(uuid) from public,anon;
revoke all on function public.create_group_conversation(text,uuid[]) from public,anon;
revoke all on function public.cancel_friend_request(uuid) from public,anon;
revoke all on function public.accept_friend_request(uuid) from public,anon;
revoke all on function public.decline_friend_request(uuid) from public,anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
grant execute on function public.create_group_conversation(text,uuid[]) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
revoke all on function public.add_group_members(uuid,uuid[]) from public,anon;
revoke all on function public.remove_group_member(uuid,uuid) from public,anon;
revoke all on function public.leave_group(uuid) from public,anon;
revoke all on function public.rename_group(uuid,text) from public,anon;
revoke all on function public.update_group_details(uuid,text,text) from public,anon;
revoke all on function public.update_group_permissions(uuid,text,text) from public,anon;
revoke all on function public.set_group_moderator(uuid,uuid,boolean) from public,anon;
revoke all on function public.delete_group(uuid) from public,anon;
grant execute on function public.add_group_members(uuid,uuid[]) to authenticated;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.rename_group(uuid,text) to authenticated;
grant execute on function public.update_group_details(uuid,text,text) to authenticated;
grant execute on function public.update_group_permissions(uuid,text,text) to authenticated;
grant execute on function public.set_group_moderator(uuid,uuid,boolean) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
revoke all on function public.hide_conversation_for_me(uuid) from public,anon;
revoke all on function public.clear_conversation_for_me(uuid) from public,anon;
revoke all on function public.clear_conversation_for_everyone(uuid) from public,anon;
revoke all on function public.delete_direct_conversation(uuid) from public,anon;
revoke all on function public.edit_message(uuid,text) from public,anon;
revoke all on function public.delete_message_for_everyone(uuid) from public,anon;
revoke all on function public.mark_message_delivered(uuid) from public,anon;
revoke all on function public.mark_message_read(uuid) from public,anon;
revoke all on function public.save_video_duration(uuid,integer) from public,anon;
revoke all on function public.cancel_scheduled_message(uuid) from public,anon;
grant execute on function public.hide_conversation_for_me(uuid) to authenticated;
grant execute on function public.clear_conversation_for_me(uuid) to authenticated;
grant execute on function public.clear_conversation_for_everyone(uuid) to authenticated;
grant execute on function public.delete_direct_conversation(uuid) to authenticated;
grant execute on function public.edit_message(uuid,text) to authenticated;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
grant execute on function public.mark_message_delivered(uuid) to authenticated;
grant execute on function public.mark_message_read(uuid) to authenticated;
grant execute on function public.save_video_duration(uuid,integer) to authenticated;
grant execute on function public.cancel_scheduled_message(uuid) to authenticated;


-- 7) Replace pair-only conversation/message authorization with membership checks.
drop policy if exists "Participants can view conversations" on public.conversations;
drop policy if exists "Users can start direct conversations" on public.conversations;
drop policy if exists "Active members can view conversations" on public.conversations;
create policy "Active members can view conversations"
on public.conversations for select to authenticated
using (public.is_conversation_member(id));

drop policy if exists "Participants can view messages" on public.messages;
drop policy if exists "Participants can send messages as themselves" on public.messages;
drop policy if exists "Recipients can mark messages as read" on public.messages;
drop policy if exists "Active members can view messages" on public.messages;
create policy "Active members can view messages"
on public.messages for select to authenticated
using (public.is_conversation_member(conversation_id));

drop policy if exists "Active members can send messages as themselves" on public.messages;
create policy "Active members can send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_conversation_member(conversation_id)
  and not public.is_direct_conversation_blocked(conversation_id)
  and (
    reply_to is null
    or exists (
      select 1 from public.messages parent
      where parent.id = messages.reply_to
        and parent.conversation_id = messages.conversation_id
    )
  )
);

-- Restrict column privileges as well as row policies: otherwise a recipient
-- could alter message body/sender fields while satisfying a broad UPDATE policy.
revoke update on public.messages from authenticated;
revoke update on public.message_receipts from authenticated;
revoke update on public.scheduled_messages from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Explicit Data API grants. RLS remains the row-level authorization boundary.
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
revoke insert on public.messages from public, anon, authenticated;
grant insert (conversation_id, sender_id, body, attachment, reply_to) on public.messages to authenticated;
grant select on public.conversation_members to authenticated;
grant select on public.message_receipts to authenticated;
grant select, insert, delete on public.message_user_visibility to authenticated;
grant select on public.friend_requests to authenticated;
revoke update on public.friend_requests from authenticated;
-- Friend-request responses must go through the atomic RPC so acceptance
-- cannot change status without creating both friendship edges.
grant select on public.friendships to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert on public.user_reports to authenticated;
grant select, insert on public.scheduled_messages to authenticated;
revoke update on public.scheduled_messages from authenticated;
-- Scheduled-message cancellation is handled by the authenticated RPC.
grant select on public.notifications to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Keep the Supabase Realtime publication aligned with the tables the client
-- needs for live membership, delivery/read receipts, notifications and social updates.
do $realtime$
declare v_table text;
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    foreach v_table in array array[
      'conversation_members','message_receipts','notifications',
      'friend_requests','friendships','user_blocks','scheduled_messages'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname='supabase_realtime'
          and schemaname='public' and tablename=v_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end;
$realtime$;

-- All message and receipt updates use narrow authenticated RPCs.
drop policy if exists "Recipients can mark own incoming messages read" on public.messages;

commit;

-- IMPORTANT FOLLOW-UP BEFORE APPLYING:
-- Review direct-conversation creation RPC/trigger, group creation and membership
-- RPCs, reciprocal friendship writes, receipt ownership, admin-only policies,
-- attachment Storage policies, and the app's exact legacy field mapping.
-- This draft intentionally does not grant clients arbitrary membership writes,
-- admin table access, or access to service-role credentials.
