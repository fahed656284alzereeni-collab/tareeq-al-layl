
create index if not exists conversation_preferences_user_id_idx
on public.conversation_preferences(user_id);
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
with check (
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
);
