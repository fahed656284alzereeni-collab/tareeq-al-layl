
drop policy if exists "mersal_attachment_read_conversation_members" on storage.objects;
create policy "mersal_attachment_read_conversation_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'mersal-attachments'
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(objects.name))[1]
      and (
        (
          not c.is_group
          and (c.user_one = (select auth.uid()) or c.user_two = (select auth.uid()))
        )
        or
        (
          c.is_group
          and (
            c.user_one = (select auth.uid())
            or exists (
              select 1
              from public.conversation_members cm
              where cm.conversation_id = c.id
                and cm.user_id = (select auth.uid())
            )
          )
        )
      )
  )
);

drop policy if exists "mersal_attachment_upload_as_sender" on storage.objects;
create policy "mersal_attachment_upload_as_sender"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'mersal-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (
        (
          not c.is_group
          and (c.user_one = (select auth.uid()) or c.user_two = (select auth.uid()))
        )
        or
        (
          c.is_group
          and (
            c.user_one = (select auth.uid())
            or exists (
              select 1
              from public.conversation_members cm
              where cm.conversation_id = c.id
                and cm.user_id = (select auth.uid())
            )
          )
        )
      )
  )
);
