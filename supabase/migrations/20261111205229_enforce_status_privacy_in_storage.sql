drop policy if exists mersal_status_read_active_visible on storage.objects;
create policy mersal_status_read_active_visible on storage.objects
for select to authenticated
using (
  bucket_id = 'mersal-attachments'
  and (storage.foldername(name))[1] = 'statuses'
  and exists (
    select 1 from public.statuses s
    where s.media_path = objects.name
      and s.expires_at > now()
      and private.can_view_status(s.user_id, (select auth.uid()))
  )
);
