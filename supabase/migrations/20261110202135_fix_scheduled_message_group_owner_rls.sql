drop policy if exists scheduled_messages_insert_own on public.scheduled_messages;

create policy scheduled_messages_insert_own
on public.scheduled_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and scheduled_at > now()
  and exists (
    select 1
    from public.conversations c
    where c.id = scheduled_messages.conversation_id
      and (
        (
          not c.is_group
          and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
          and not exists (
            select 1
            from public.user_blocks ub
            where
              (ub.blocker_id = (select auth.uid())
                and ub.blocked_id = case
                  when c.user_one = (select auth.uid()) then c.user_two
                  else c.user_one
                end)
              or
              (ub.blocked_id = (select auth.uid())
                and ub.blocker_id = case
                  when c.user_one = (select auth.uid()) then c.user_two
                  else c.user_one
                end)
          )
        )
        or
        (
          c.is_group
          and (
            c.user_one = (select auth.uid())
            or exists (
              select 1
              from public.conversation_members cm
              where cm.conversation_id = c.id
                and cm.user_id = (select auth.uid())
            )
          )
        )
      )
  )
);
