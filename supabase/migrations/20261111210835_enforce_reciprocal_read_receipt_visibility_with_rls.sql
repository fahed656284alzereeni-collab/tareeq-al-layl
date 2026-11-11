create or replace function private.can_show_read_receipt(p_owner_id uuid,p_reader_id uuid,p_is_group boolean)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_owner_id=(select auth.uid())
    and case
      when coalesce(p_is_group,false) then true
      else coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=p_owner_id),true)
       and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=p_reader_id),true)
    end;
$$;
revoke all on function private.can_show_read_receipt(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.can_show_read_receipt(uuid,uuid,boolean) to authenticated;

drop policy if exists message_reads_select_participants on public.message_reads;
create policy message_reads_select_participants on public.message_reads
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1 from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.id=message_reads.message_id
      and m.sender_id=(select auth.uid())
      and private.can_show_read_receipt(m.sender_id,message_reads.user_id,c.is_group)
  )
);

drop policy if exists status_views_owner_read on public.status_views;
create policy status_views_owner_read on public.status_views
for select to authenticated
using (
  exists (
    select 1 from public.statuses s
    where s.id=status_views.status_id
      and s.user_id=(select auth.uid())
      and private.can_show_read_receipt(s.user_id,status_views.viewer_id,false)
  )
);
