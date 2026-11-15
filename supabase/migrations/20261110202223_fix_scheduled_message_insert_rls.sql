
create or replace function private.can_schedule_message(
  p_conversation_id uuid,
  p_sender_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_sender_id = (select auth.uid())
    and p_sender_id is not null
    and exists (
      select 1
      from public.conversations c
      where c.id = p_conversation_id
        and (
          (
            c.is_group = true
            and (
              c.user_one = p_sender_id
              or exists (
                select 1
                from public.conversation_members cm
                where cm.conversation_id = c.id
                  and cm.user_id = p_sender_id
              )
            )
          )
          or
          (
            c.is_group = false
            and (c.user_one = p_sender_id or c.user_two = p_sender_id)
            and not exists (
              select 1
              from public.user_blocks ub
              where (
                (ub.blocker_id = p_sender_id and ub.blocked_id =
                  case when c.user_one = p_sender_id then c.user_two else c.user_one end)
                or
                (ub.blocked_id = p_sender_id and ub.blocker_id =
                  case when c.user_one = p_sender_id then c.user_two else c.user_one end)
              )
            )
          )
        )
    );
$function$;

revoke all on function private.can_schedule_message(uuid, uuid) from public, anon;
grant execute on function private.can_schedule_message(uuid, uuid) to authenticated;

drop policy if exists scheduled_messages_insert_own on public.scheduled_messages;
create policy scheduled_messages_insert_own
  on public.scheduled_messages
  for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and scheduled_at > now()
    and private.can_schedule_message(conversation_id, sender_id)
  );
