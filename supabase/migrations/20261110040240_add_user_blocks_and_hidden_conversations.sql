
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_involved on public.user_blocks;
create policy user_blocks_select_involved
on public.user_blocks for select to authenticated
using (blocker_id = (select auth.uid()) or blocked_id = (select auth.uid()));

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own
on public.user_blocks for insert to authenticated
with check (blocker_id = (select auth.uid()) and blocked_id <> (select auth.uid()));

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own
on public.user_blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

create table if not exists public.conversation_hidden_for (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_hidden_for enable row level security;

drop policy if exists conversation_hidden_select_own on public.conversation_hidden_for;
create policy conversation_hidden_select_own
on public.conversation_hidden_for for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists conversation_hidden_insert_own on public.conversation_hidden_for;
create policy conversation_hidden_insert_own
on public.conversation_hidden_for for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (
        (not c.is_group and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two))
        or
        (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        ))
      )
  )
);

drop policy if exists conversation_hidden_delete_own on public.conversation_hidden_for;
create policy conversation_hidden_delete_own
on public.conversation_hidden_for for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists messages_insert_as_self_in_conversation on public.messages;
create policy messages_insert_as_self_in_conversation
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        ((not c.is_group)
          and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
          and not exists (
            select 1
            from public.user_blocks ub
            where
              (ub.blocker_id = (select auth.uid())
                and ub.blocked_id = case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
              or
              (ub.blocked_id = (select auth.uid())
                and ub.blocker_id = case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
          )
        )
        or
        (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        ))
      )
  )
);
