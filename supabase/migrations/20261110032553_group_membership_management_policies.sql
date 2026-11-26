
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select
on public.conversation_members for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.is_group = true
      and c.user_one = (select auth.uid())
  )
);
drop policy if exists conversation_members_delete_self on public.conversation_members;
create policy conversation_members_delete_self
on public.conversation_members for delete to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.is_group = true
      and (
        (conversation_members.user_id = (select auth.uid()) and c.user_one <> (select auth.uid()))
        or (c.user_one = (select auth.uid()) and conversation_members.user_id <> (select auth.uid()))
      )
  )
);
drop policy if exists conversation_preferences_update_own on public.conversation_preferences;
create policy conversation_preferences_update_own
on public.conversation_preferences for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_preferences.conversation_id
      and (
        (not c.is_group and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two))
        or (c.is_group and (
          c.user_one = (select auth.uid())
          or exists (
            select 1 from public.conversation_members cm
            where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
          )
        ))
      )
  )
)
with check (user_id = (select auth.uid()));
