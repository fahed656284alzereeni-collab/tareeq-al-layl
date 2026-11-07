-- Move SECURITY DEFINER authorization helpers out of the exposed public schema.
-- Public callers retain only an invoker wrapper for the direct-message block check.
begin;

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id=p_conversation_id
      and cm.user_id=auth.uid()
      and cm.left_at is null
  );
$fn$;
revoke all on function private.is_conversation_member(uuid) from public,anon;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create or replace function private.is_direct_conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
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
revoke all on function private.is_direct_conversation_blocked(uuid) from public,anon;
grant execute on function private.is_direct_conversation_blocked(uuid) to authenticated;

-- This exposed function is deliberately SECURITY INVOKER; only its private
-- helper receives definer rights, and it returns only the caller's own block state.
create or replace function public.is_direct_conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $fn$
  select private.is_direct_conversation_blocked(p_conversation_id);
$fn$;
revoke all on function public.is_direct_conversation_blocked(uuid) from public,anon;
grant execute on function public.is_direct_conversation_blocked(uuid) to authenticated;

drop policy if exists "Members can view their conversation memberships" on public.conversation_members;
create policy "Members can view their conversation memberships"
on public.conversation_members for select to authenticated
using (private.is_conversation_member(conversation_id));

drop policy if exists "Users can view receipts in their conversations" on public.message_receipts;
create policy "Users can view receipts in their conversations"
on public.message_receipts for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1 from public.messages m
    where m.id=message_id and private.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Users can manage own message visibility" on public.message_user_visibility;
create policy "Users can manage own message visibility"
on public.message_user_visibility for all to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id=message_id and private.is_conversation_member(m.conversation_id)
  )
)
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id=message_id and private.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Users can view their scheduled messages" on public.scheduled_messages;
create policy "Users can view their scheduled messages"
on public.scheduled_messages for select to authenticated
using (sender_id=(select auth.uid()) and private.is_conversation_member(conversation_id));

drop policy if exists "Users can schedule messages as themselves" on public.scheduled_messages;
create policy "Users can schedule messages as themselves"
on public.scheduled_messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and private.is_conversation_member(conversation_id)
  and scheduled_for>now()
  and char_length(body)<=4000
  and (char_length(body)>0 or attachment is not null)
  and not public.is_direct_conversation_blocked(conversation_id)
);

drop policy if exists "Active members can view conversations" on public.conversations;
create policy "Active members can view conversations"
on public.conversations for select to authenticated
using (private.is_conversation_member(id));

drop policy if exists "Active members can view messages" on public.messages;
create policy "Active members can view messages"
on public.messages for select to authenticated
using (private.is_conversation_member(conversation_id));

drop policy if exists "Active members can send messages as themselves" on public.messages;
create policy "Active members can send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id=(select auth.uid())
  and private.is_conversation_member(conversation_id)
  and not public.is_direct_conversation_blocked(conversation_id)
  and (
    reply_to is null
    or exists (
      select 1 from public.messages parent
      where parent.id=messages.reply_to
        and parent.conversation_id=messages.conversation_id
    )
  )
);

-- All RLS dependencies now use the private helper.
drop function if exists public.is_conversation_member(uuid);

commit;
