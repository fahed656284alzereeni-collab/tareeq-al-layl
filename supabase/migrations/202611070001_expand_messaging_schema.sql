-- Phase 1: Expand the existing Supabase prototype for Mersal.
-- DESIGN / REVIEW MIGRATION ONLY. Do not apply to production until reviewed and tested.
-- Existing conversations/messages tables are extended additively; legacy columns are retained.

begin;

-- 1) Conversation metadata and normalized membership.
alter table public.conversations
  add column if not exists type text not null default 'direct',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_message_at timestamptz;

-- Group conversations do not need the legacy direct pair columns.
alter table public.conversations
  alter column user_one drop not null,
  alter column user_two drop not null;

alter table public.conversations
  add constraint conversations_type_check check (type in ('direct','group'));

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
create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_user_id
      and cm.left_at is null
  );
$$;

revoke all on function public.is_conversation_member(uuid,uuid) from public;
grant execute on function public.is_conversation_member(uuid,uuid) to authenticated;

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
create policy "Recipients can update own receipts"
on public.message_receipts for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can view own message visibility" on public.message_user_visibility;
create policy "Users can view own message visibility"
on public.message_user_visibility for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can manage own message visibility" on public.message_user_visibility;
create policy "Users can manage own message visibility"
on public.message_user_visibility for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users can view own sent or received friend requests" on public.friend_requests;
create policy "Users can view own sent or received friend requests"
on public.friend_requests for select to authenticated
using ((sender_id = (select auth.uid())) or (recipient_id = (select auth.uid())));

drop policy if exists "Users can send friend requests as themselves" on public.friend_requests;
create policy "Users can send friend requests as themselves"
on public.friend_requests for insert to authenticated
with check (sender_id = (select auth.uid()) and sender_id <> recipient_id);

drop policy if exists "Recipients can respond to friend requests" on public.friend_requests;
create policy "Recipients can respond to friend requests"
on public.friend_requests for update to authenticated
using (recipient_id = (select auth.uid()) and status = 'pending')
with check (recipient_id = (select auth.uid()) and status in ('accepted','declined'));

drop policy if exists "Users can view their friendships" on public.friendships;
create policy "Users can view their friendships"
on public.friendships for select to authenticated
using (user_id = (select auth.uid()) or friend_id = (select auth.uid()));

drop policy if exists "Users can remove their own friendship edge" on public.friendships;
create policy "Users can remove their own friendship edge"
on public.friendships for delete to authenticated
using (user_id = (select auth.uid()));

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
with check (sender_id = (select auth.uid()) and public.is_conversation_member(conversation_id));

drop policy if exists "Users can cancel their pending scheduled messages" on public.scheduled_messages;
create policy "Users can cancel their pending scheduled messages"
on public.scheduled_messages for update to authenticated
using (sender_id = (select auth.uid()) and status = 'pending')
with check (sender_id = (select auth.uid()) and status = 'cancelled');

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- 7) Replace pair-only conversation/message authorization with membership checks.
drop policy if exists "Participants can view conversations" on public.conversations;
drop policy if exists "Users can start direct conversations" on public.conversations;
create policy "Active members can view conversations"
on public.conversations for select to authenticated
using (public.is_conversation_member(id));

drop policy if exists "Participants can view messages" on public.messages;
drop policy if exists "Participants can send messages as themselves" on public.messages;
drop policy if exists "Recipients can mark messages as read" on public.messages;
create policy "Active members can view messages"
on public.messages for select to authenticated
using (public.is_conversation_member(conversation_id));

create policy "Active members can send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_conversation_member(conversation_id)
);

-- Client updates are limited to marking a message read. More privileged
-- edit/delete operations will be exposed through verified server/RPC paths.
create policy "Recipients can mark own incoming messages read"
on public.messages for update to authenticated
using (
  sender_id <> (select auth.uid())
  and public.is_conversation_member(conversation_id)
)
with check (
  sender_id <> (select auth.uid())
  and read_at is not null
  and public.is_conversation_member(conversation_id)
);

commit;

-- IMPORTANT FOLLOW-UP BEFORE APPLYING:
-- Review direct-conversation creation RPC/trigger, group creation and membership
-- RPCs, reciprocal friendship writes, receipt ownership, admin-only policies,
-- attachment Storage policies, and the app's exact legacy field mapping.
-- This draft intentionally does not grant clients arbitrary membership writes,
-- admin table access, or access to service-role credentials.
