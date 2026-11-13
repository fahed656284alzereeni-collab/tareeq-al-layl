
drop policy if exists "group_polls_delete_creator" on public.group_polls;
create policy "group_polls_delete_creator" on public.group_polls for delete to authenticated
using (created_by = (select auth.uid()) and (private.is_group_owner(conversation_id) or private.is_group_member(conversation_id)));
create or replace function private.validate_group_poll()
returns trigger language plpgsql set search_path = '' as $$
declare option_value jsonb; normalized_options text[] := array[]::text[]; option_text text;
begin
  if new.created_by <> (select auth.uid()) then raise exception 'Poll creator must be the signed-in user'; end if;
  if not (private.is_group_owner(new.conversation_id) or private.is_group_member(new.conversation_id)) then raise exception 'Only group members can create polls'; end if;
  if char_length(btrim(new.question)) < 1 or char_length(new.question) > 240 then raise exception 'Poll question must be between 1 and 240 characters'; end if;
  if jsonb_typeof(new.options) <> 'array' or jsonb_array_length(new.options) < 2 or jsonb_array_length(new.options) > 10 then raise exception 'Polls must have between 2 and 10 options'; end if;
  for option_value in select value from jsonb_array_elements(new.options) loop
    if jsonb_typeof(option_value) <> 'string' then raise exception 'Poll options must be text'; end if;
    option_text := btrim(option_value #>> '{}');
    if char_length(option_text) < 1 or char_length(option_text) > 120 then raise exception 'Poll options must be between 1 and 120 characters'; end if;
    if lower(option_text) = any(normalized_options) then raise exception 'Poll options must be unique'; end if;
    normalized_options := array_append(normalized_options, lower(option_text));
  end loop;
  return new;
end;
$$;
create trigger validate_group_poll_before_insert before insert on public.group_polls
for each row execute function private.validate_group_poll();
