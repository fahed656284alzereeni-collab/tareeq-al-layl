create table if not exists public.group_invites (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.group_invites enable row level security;
revoke all on public.group_invites from anon, authenticated;
grant select on public.group_invites to authenticated;

drop policy if exists group_invites_select_members on public.group_invites;
create policy group_invites_select_members
on public.group_invites for select to authenticated
using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = group_invites.conversation_id
      and cm.user_id = (select auth.uid())
  )
);

create or replace function public.get_or_create_group_invite(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and c.is_group = true
  ) then
    raise exception 'Group membership required';
  end if;

  insert into public.group_invites (conversation_id, created_by)
  values (p_conversation_id, auth.uid())
  on conflict (conversation_id) do nothing;

  select gi.token into v_token
  from public.group_invites gi
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
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and cm.role = 'admin'
      and c.is_group = true
  ) then
    raise exception 'Group admin required';
  end if;

  update public.group_invites
  set token = gen_random_uuid(), created_by = auth.uid(), updated_at = now()
  where conversation_id = p_conversation_id
  returning token into v_token;

  if v_token is null then
    insert into public.group_invites (conversation_id, created_by)
    values (p_conversation_id, auth.uid())
    returning token into v_token;
  end if;

  return v_token;
end;
$$;

create or replace function public.join_group_by_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select gi.conversation_id into v_conversation_id
  from public.group_invites gi
  join public.conversations c on c.id = gi.conversation_id
  where gi.token = p_token and c.is_group = true;

  if v_conversation_id is null then
    raise exception 'Invalid or expired group invite';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conversation_id, auth.uid(), 'member')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function public.get_or_create_group_invite(uuid) from public, anon;
revoke all on function public.reset_group_invite(uuid) from public, anon;
revoke all on function public.join_group_by_invite(uuid) from public, anon;
grant execute on function public.get_or_create_group_invite(uuid) to authenticated;
grant execute on function public.reset_group_invite(uuid) to authenticated;
grant execute on function public.join_group_by_invite(uuid) to authenticated;
