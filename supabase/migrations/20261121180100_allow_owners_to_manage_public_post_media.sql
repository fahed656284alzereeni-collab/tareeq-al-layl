drop policy if exists public_post_media_read_authenticated on storage.objects;
create policy public_post_media_read_authenticated on storage.objects
for select to authenticated using (
  bucket_id = 'mersal-attachments'
  and (storage.foldername(name))[1] = 'public-posts'
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or exists (select 1 from public.public_posts p where p.media_path = objects.name)
  )
);