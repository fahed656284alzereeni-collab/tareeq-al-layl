create or replace function public.bump_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$function$;
