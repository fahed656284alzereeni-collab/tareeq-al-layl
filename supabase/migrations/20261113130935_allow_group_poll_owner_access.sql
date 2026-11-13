
drop policy if exists "group_polls_select_members" on public.group_polls;
create policy "group_polls_select_members" on public.group_polls for select to authenticated
using (private.is_group_owner(conversation_id) or private.is_group_member(conversation_id));
drop policy if exists "group_polls_insert_members" on public.group_polls;
create policy "group_polls_insert_members" on public.group_polls for insert to authenticated
with check (created_by = (select auth.uid()) and (private.is_group_owner(conversation_id) or private.is_group_member(conversation_id)));
drop policy if exists "group_poll_votes_select_members" on public.group_poll_votes;
create policy "group_poll_votes_select_members" on public.group_poll_votes for select to authenticated
using (exists (select 1 from public.group_polls p where p.id = poll_id and (private.is_group_owner(p.conversation_id) or private.is_group_member(p.conversation_id))));
drop policy if exists "group_poll_votes_insert_self" on public.group_poll_votes;
create policy "group_poll_votes_insert_self" on public.group_poll_votes for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.group_polls p where p.id = poll_id and (private.is_group_owner(p.conversation_id) or private.is_group_member(p.conversation_id))));
drop policy if exists "group_poll_votes_update_self" on public.group_poll_votes;
create policy "group_poll_votes_update_self" on public.group_poll_votes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (select 1 from public.group_polls p where p.id = poll_id and (private.is_group_owner(p.conversation_id) or private.is_group_member(p.conversation_id))));
