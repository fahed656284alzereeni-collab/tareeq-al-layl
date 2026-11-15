
create or replace function private.delete_group(p_conversation_id uuid, p_delete_for_everyone boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_other uuid;
  v_user_two uuid;
begin
  if v_user is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  select c.user_one, c.user_two
    into v_owner, v_user_two
  from public.conversations c
  where c.id = p_conversation_id and c.is_group
  for update;

  if not found then
    raise exception 'المجموعة غير موجودة';
  end if;

  if p_delete_for_everyone then
    if v_owner <> v_user then
      raise exception 'حذف المجموعة للجميع متاح لمنشئ المجموعة فقط';
    end if;
    delete from public.conversations where id = p_conversation_id;
    return;
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = v_user
  ) then
    raise exception 'أنت لست عضوًا في هذه المجموعة';
  end if;

  if v_owner = v_user then
    select cm.user_id into v_other
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id <> v_user
    order by cm.joined_at asc, cm.user_id asc
    limit 1;

    if v_other is null then
      delete from public.conversations where id = p_conversation_id;
      return;
    end if;

    update public.conversations
      set user_one = v_other,
          user_two = case when v_user_two = v_other then v_user else v_user_two end
      where id = p_conversation_id;

    update public.conversation_members
      set role = case when user_id = v_other then 'admin' else 'member' end
      where conversation_id = p_conversation_id;
  end if;

  delete from public.conversation_members
  where conversation_id = p_conversation_id and user_id = v_user;
end;
$$;

revoke all on function private.delete_group(uuid, boolean) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.delete_group(uuid, boolean) to authenticated;

create or replace function public.delete_group(p_conversation_id uuid, p_delete_for_everyone boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.delete_group(p_conversation_id, p_delete_for_everyone);
end;
$$;

revoke all on function public.delete_group(uuid, boolean) from public, anon;
grant execute on function public.delete_group(uuid, boolean) to authenticated;
