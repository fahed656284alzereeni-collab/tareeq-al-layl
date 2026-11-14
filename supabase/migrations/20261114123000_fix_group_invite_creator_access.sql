-- Treat the conversation creator as the effective group owner even when legacy groups
-- do not contain a duplicate conversation_members row for that creator.
create or replace function public.get_or_create_group_invite(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_token uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.is_group = true
      and (c.user_one = v_user_id or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c.id and cm.user_id = v_user_id
      ))
  ) then raise exception 'Group membership required'; end if;
  insert into public.group_invites (conversation_id, created_by)
  values (p_conversation_id, v_user_id)
  on conflict (conversation_id) do nothing;
  select gi.token into v_token from public.group_invites gi
  where gi.conversation_id = p_conversation_id;
  return v_token;
end;
$$;

create or replace function public.reset_group_invite(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_token uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.is_group = true
      and (c.user_one = v_user_id or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c.id and cm.user_id = v_user_id and cm.role = 'admin'
      ))
  ) then raise exception 'Group admin required'; end if;
  update public.group_invites
  set token = gen_random_uuid(), created_by = v_user_id, updated_at = now()
  where conversation_id = p_conversation_id
  returning token into v_token;
  if v_token is null then
    insert into public.group_invites (conversation_id, created_by)
    values (p_conversation_id, v_user_id)
    returning token into v_token;
  end if;
  return v_token;
end;
$$;

drop policy if exists group_invites_select_members on public.group_invites;
create policy group_invites_select_members
on public.group_invites for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = group_invites.conversation_id
      and (c.user_one = (select auth.uid()) or exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
      ))
  )
);

revoke all on function public.get_or_create_group_invite(uuid) from public, anon;
revoke all on function public.reset_group_invite(uuid) from public, anon;
grant execute on function public.get_or_create_group_invite(uuid) to authenticated;
grant execute on function public.reset_group_invite(uuid) to authenticated;
