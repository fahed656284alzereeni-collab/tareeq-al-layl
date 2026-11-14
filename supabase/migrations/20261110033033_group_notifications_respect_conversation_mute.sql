
alter table public.notifications drop constraint if exists notifications_message_id_key;
create unique index if not exists notifications_recipient_message_uidx
on public.notifications(recipient_id, message_id);
create or replace function public.create_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  group_chat boolean;
  recipient uuid;
begin
  select c.is_group into group_chat
  from public.conversations c
  where c.id = new.conversation_id;
  if coalesce(group_chat, false) then
    insert into public.notifications
      (recipient_id, sender_id, conversation_id, message_id, preview)
    select cm.user_id, new.sender_id, new.conversation_id, new.id, left(new.body, 160)
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and not exists (
        select 1 from public.conversation_preferences cp
        where cp.conversation_id = new.conversation_id
          and cp.user_id = cm.user_id and cp.muted = true
      )
    on conflict (recipient_id, message_id) do nothing;
  else
    select case when c.user_one = new.sender_id then c.user_two
                when c.user_two = new.sender_id then c.user_one
                else null end
      into recipient
    from public.conversations c where c.id = new.conversation_id;
    if recipient is not null and not exists (
      select 1 from public.conversation_preferences cp
      where cp.conversation_id = new.conversation_id
        and cp.user_id = recipient and cp.muted = true
    ) then
      insert into public.notifications
        (recipient_id, sender_id, conversation_id, message_id, preview)
      values (recipient, new.sender_id, new.conversation_id, new.id, left(new.body, 160))
      on conflict (recipient_id, message_id) do nothing;
    end if;
  end if;
  return new;
end;
$function$;
