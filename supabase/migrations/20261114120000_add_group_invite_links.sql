alter table public.conversations
  add column if not exists group_invite_token text;

create unique index if not exists conversations_group_invite_token_uidx
  on public.conversations (group_invite_token)
  where group_invite_token is not null;

create or replace function private.join_group_by_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 100 then
    raise exception 'رابط دعوة المجموعة غير صالح';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.is_group = true
    and c.group_invite_token = p_token;

  if v_conversation_id is null then
    raise exception 'رابط الدعوة غير صالح أو تم إعادة تعيينه';
  end if;

  if exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = v_conversation_id
      and cm.user_id = v_user_id
  ) then
    return v_conversation_id;
  end if;

  if not private.can_add_user_to_group(v_user_id) then
    raise exception 'لا يمكن إضافتك إلى هذه المجموعة بسبب إعدادات الخصوصية أو الحظر';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conversation_id, v_user_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

revoke all on function private.join_group_by_invite(text) from public, anon, authenticated;

create or replace function public.join_group_by_invite(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_group_by_invite(p_token);
$$;

revoke all on function public.join_group_by_invite(text) from public, anon;
grant execute on function public.join_group_by_invite(text) to authenticated;
