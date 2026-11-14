
drop policy if exists group_polls_select_members on public.group_polls;
drop policy if exists group_polls_insert_members on public.group_polls;
drop policy if exists group_polls_delete_creator on public.group_polls;

create policy group_polls_select_conversation_participants
on public.group_polls
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = group_polls.conversation_id
      and (
        (
          c.is_group
          and (
            private.is_group_owner(c.id)
            or private.is_group_member(c.id)
          )
        )
        or (
          not c.is_group
          and (
            c.user_one = (select auth.uid())
            or c.user_two = (select auth.uid())
          )
        )
      )
  )
);

create policy group_polls_insert_conversation_participants
on public.group_polls
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = group_polls.conversation_id
      and (
        (
          c.is_group
          and (
            private.is_group_owner(c.id)
            or private.is_group_member(c.id)
          )
        )
        or (
          not c.is_group
          and (
            c.user_one = (select auth.uid())
            or c.user_two = (select auth.uid())
          )
        )
      )
  )
);

create policy group_polls_delete_creator_in_conversation
on public.group_polls
for delete
to authenticated
using (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = group_polls.conversation_id
      and (
        (
          c.is_group
          and (
            private.is_group_owner(c.id)
            or private.is_group_member(c.id)
          )
        )
        or (
          not c.is_group
          and (
            c.user_one = (select auth.uid())
            or c.user_two = (select auth.uid())
          )
        )
      )
  )
);

drop policy if exists group_poll_votes_select_members on public.group_poll_votes;
drop policy if exists group_poll_votes_insert_self on public.group_poll_votes;
drop policy if exists group_poll_votes_update_self on public.group_poll_votes;

create policy group_poll_votes_select_poll_participants
on public.group_poll_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.group_polls p
    where p.id = group_poll_votes.poll_id
  )
);

create policy group_poll_votes_insert_self_in_poll
on public.group_poll_votes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    where p.id = group_poll_votes.poll_id
  )
);

create policy group_poll_votes_update_self_in_poll
on public.group_poll_votes
for update
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    where p.id = group_poll_votes.poll_id
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.group_polls p
    where p.id = group_poll_votes.poll_id
  )
);

alter publication supabase_realtime add table public.group_poll_votes;
