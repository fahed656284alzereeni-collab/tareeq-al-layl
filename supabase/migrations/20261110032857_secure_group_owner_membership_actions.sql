
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create or replace function private.is_group_owner(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.is_group = true
      and c.user_one = (select auth.uid())
  );
$$;
revoke all on function private.is_group_owner(uuid) from public;
grant execute on function private.is_group_owner(uuid) to authenticated;
drop policy if exists conversation_members_select on public.conversation_members;
create policy conversation_members_select
on public.conversation_members for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_group_owner(conversation_id))
);
drop policy if exists conversation_members_delete_self on public.conversation_members;
create policy conversation_members_delete_self
on public.conversation_members for delete to authenticated
using (
  (user_id = (select auth.uid()) and not (select private.is_group_owner(conversation_id)))
  or (user_id <> (select auth.uid()) and (select private.is_group_owner(conversation_id)))
);
