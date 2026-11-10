-- Keep scheduled delivery authorization aligned with scheduling-time authorization.
-- The group creator (conversations.user_one) may send even when not present in conversation_members.
create or replace function private.process_due_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  item record;
  inserted_message_id uuid;
  can_send boolean;
  processed_count integer := 0;
begin
  for item in
    select sm.id, sm.conversation_id, sm.sender_id, sm.body
    from public.scheduled_messages sm
    where sm.status = 'pending'
      and sm.scheduled_at <= now()
    order by sm.scheduled_at, sm.created_at
    for update skip locked
    limit 100
  loop
    select exists (
      select 1
      from public.conversations c
      where c.id = item.conversation_id
        and (
          (
            c.is_group
            and (
              c.user_one = item.sender_id
              or exists (
                select 1 from public.conversation_members cm
                where cm.conversation_id = c.id and cm.user_id = item.sender_id
              )
            )
          )
          or
          (
            not c.is_group
            and (c.user_one = item.sender_id or c.user_two = item.sender_id)
            and not exists (
              select 1 from public.user_blocks ub
              where (
                (ub.blocker_id = item.sender_id and ub.blocked_id =
                  case when c.user_one = item.sender_id then c.user_two else c.user_one end)
                or
                (ub.blocked_id = item.sender_id and ub.blocker_id =
                  case when c.user_one = item.sender_id then c.user_two else c.user_one end)
              )
            )
          )
        )
    ) into can_send;

    if can_send then
      insert into public.messages (conversation_id, sender_id, body)
      values (item.conversation_id, item.sender_id, item.body)
      returning id into inserted_message_id;

      update public.scheduled_messages
      set status = 'sent',
          sent_message_id = inserted_message_id,
          sent_at = now(),
          failure_reason = null
      where id = item.id;
    else
      update public.scheduled_messages
      set status = 'failed',
          failure_reason = 'لم تعد تملك صلاحية الإرسال في هذه المحادثة.'
      where id = item.id;
    end if;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$function$;