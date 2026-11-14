
create table if not exists public.conversation_preferences (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  muted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_preferences enable row level security;
grant select, insert, update on public.conversation_preferences to authenticated;
drop policy if exists conversation_preferences_select_own on public.conversation_preferences;
create policy conversation_preferences_select_own
on public.conversation_preferences for select to authenticated
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
);
drop policy if exists conversation_preferences_insert_own on public.conversation_preferences;
create policy conversation_preferences_insert_own
on public.conversation_preferences for insert to authenticated
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
drop policy if exists conversation_preferences_update_own on public.conversation_preferences;
create policy conversation_preferences_update_own
on public.conversation_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
drop policy if exists conversation_members_delete_self on public.conversation_members;
create policy conversation_members_delete_self
on public.conversation_members for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.is_group = true
      and c.user_one <> (select auth.uid())
  )
);
drop policy if exists conversations_update_participants on public.conversations;
create policy conversations_update_participants
on public.conversations for update to authenticated
using (
  (not is_group and ((select auth.uid()) = user_one or (select auth.uid()) = user_two))
  or (is_group and user_one = (select auth.uid()))
)
with check (
  (not is_group and ((select auth.uid()) = user_one or (select auth.uid()) = user_two))
  or (is_group and user_one = (select auth.uid()))
);
