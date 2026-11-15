create or replace function private.enforce_message_edit_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    if old.sender_id is distinct from (select auth.uid()) then
      raise exception 'Only the original sender can edit this message' using errcode = '42501';
    end if;
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'Messages can only be edited within 15 minutes' using errcode = '22023';
    end if;
    if old.body like '%MERSAL_ATTACHMENT:%' or old.body like '%MERSAL_POLL:%' then
      raise exception 'Attachments and polls cannot be edited' using errcode = '22023';
    end if;
    new.edited_at := now();
  elsif new.edited_at is distinct from old.edited_at then
    raise exception 'The edit timestamp is managed by the database' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_message_edit_window() from public, anon, authenticated;
drop trigger if exists enforce_message_edit_window on public.messages;
create trigger enforce_message_edit_window
before update on public.messages
for each row execute function private.enforce_message_edit_window();
