create or replace function private.can_select_message_read(p_message_id uuid,p_reader_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.id=p_message_id
      and m.sender_id=(select auth.uid())
      and private.can_show_read_receipt(m.sender_id,p_reader_id,c.is_group)
  );
$$;
revoke all on function private.can_select_message_read(uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_select_message_read(uuid,uuid) to authenticated;

drop policy if exists message_reads_select_participants on public.message_reads;
create policy message_reads_select_participants on public.message_reads
for select to authenticated
using (
  user_id=(select auth.uid())
  or private.can_select_message_read(message_id,user_id)
);
