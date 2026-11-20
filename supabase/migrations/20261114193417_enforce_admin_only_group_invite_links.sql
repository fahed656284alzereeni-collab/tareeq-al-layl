create or replace function public.get_or_create_group_invite(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_token uuid;
  v_add_members_by text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and c.is_group = true
      and (
        c.user_one = v_user_id
        or exists (
          select 1
          from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = v_user_id
        )
      )
  ) then
    raise exception 'Group membership required';
  end if;

  select coalesce(gs.add_members_by, 'admins')
    into v_add_members_by
  from (select 1) seed
  left join public.group_settings gs
    on gs.conversation_id = p_conversation_id;

  if v_add_members_by <> 'everyone'
     and not private.is_group_admin(p_conversation_id) then
    raise exception 'Group admin required to share invite links';
  end if;

  insert into public.group_invites (conversation_id, created_by)
  values (p_conversation_id, v_user_id)
  on conflict (conversation_id) do nothing;

  select gi.token into v_token
  from public.group_invites gi
  where gi.conversation_id = p_conversation_id;

  return v_token;
end;
$function$;

create or replace function private.rotate_group_invite_when_add_members_restricted()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.add_members_by = 'admins' then
    if tg_op = 'INSERT' then
      update public.group_invites
      set token = gen_random_uuid(), updated_at = now()
      where conversation_id = new.conversation_id;
    elsif old.add_members_by is distinct from new.add_members_by then
      update public.group_invites
      set token = gen_random_uuid(), updated_at = now()
      where conversation_id = new.conversation_id;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists group_settings_rotate_invite_on_admins_only on public.group_settings;
create trigger group_settings_rotate_invite_on_admins_only
after insert or update of add_members_by
on public.group_settings
for each row
execute function private.rotate_group_invite_when_add_members_restricted();
