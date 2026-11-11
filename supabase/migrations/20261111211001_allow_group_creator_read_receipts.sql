drop policy if exists message_reads_insert_self on public.message_reads;
create policy message_reads_insert_self on public.message_reads
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (
    select 1
    from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.id=message_reads.message_id
      and m.sender_id<>(select auth.uid())
      and (
        (
          not c.is_group
          and (
            (c.user_one=(select auth.uid()) and c.user_two=m.sender_id)
            or (c.user_two=(select auth.uid()) and c.user_one=m.sender_id)
          )
          and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=(select auth.uid())),true)
        )
        or (
          c.is_group
          and (
            c.user_one=(select auth.uid())
            or exists(
              select 1 from public.conversation_members cm
              where cm.conversation_id=c.id and cm.user_id=(select auth.uid())
            )
          )
        )
      )
  )
);
