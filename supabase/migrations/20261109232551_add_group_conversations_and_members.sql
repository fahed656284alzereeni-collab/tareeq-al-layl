
alter table public.conversations
  add column if not exists is_group boolean not null default false,
  add column if not exists group_name text;
alter table public.conversations drop constraint if exists conversations_unique_pair;
create unique index if not exists conversations_unique_pair
  on public.conversations(user_one,user_two) where is_group = false;
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members(user_id,conversation_id);
alter table public.conversation_members enable row level security;
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select on public.conversation_members for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.conversation_members mine where mine.conversation_id=conversation_members.conversation_id and mine.user_id=(select auth.uid()))
);
drop policy if exists conversation_members_insert_admin on public.conversation_members;
create policy conversation_members_insert_admin on public.conversation_members for insert to authenticated with check (
 exists(select 1 from public.conversations c where c.id=conversation_id and c.is_group=true and c.user_one=(select auth.uid()))
);
drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant on public.conversations for insert to authenticated with check (
 user_one<>user_two and ((select auth.uid())=user_one or (not is_group and (select auth.uid())=user_two))
);
drop policy if exists conversations_select_participants on public.conversations;
create policy conversations_select_participants on public.conversations for select to authenticated using (
 (not is_group and ((select auth.uid())=user_one or (select auth.uid())=user_two))
 or (is_group and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversations.id and cm.user_id=(select auth.uid())))
);
drop policy if exists conversations_update_participants on public.conversations;
create policy conversations_update_participants on public.conversations for update to authenticated using (
 (not is_group and ((select auth.uid())=user_one or (select auth.uid())=user_two))
 or (is_group and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversations.id and cm.user_id=(select auth.uid())))
) with check (
 (not is_group and ((select auth.uid())=user_one or (select auth.uid())=user_two))
 or (is_group and exists(select 1 from public.conversation_members cm where cm.conversation_id=conversations.id and cm.user_id=(select auth.uid())))
);
drop policy if exists messages_insert_as_self_in_conversation on public.messages;
create policy messages_insert_as_self_in_conversation on public.messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and exists(select 1 from public.conversations c where c.id=messages.conversation_id and (
 (not c.is_group and ((select auth.uid())=c.user_one or (select auth.uid())=c.user_two))
 or (c.is_group and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=(select auth.uid())))
 ))
);
drop policy if exists messages_select_conversation_participants on public.messages;
create policy messages_select_conversation_participants on public.messages for select to authenticated using (
 exists(select 1 from public.conversations c where c.id=messages.conversation_id and (
 (not c.is_group and ((select auth.uid())=c.user_one or (select auth.uid())=c.user_two))
 or (c.is_group and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=(select auth.uid())))
 ))
);
drop policy if exists message_hidden_for_insert_own on public.message_hidden_for;
create policy message_hidden_for_insert_own on public.message_hidden_for for insert to authenticated with check (
 user_id=(select auth.uid()) and exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=message_hidden_for.message_id and (
 (not c.is_group and ((select auth.uid())=c.user_one or (select auth.uid())=c.user_two))
 or (c.is_group and exists(select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=(select auth.uid())))
 ))
);
