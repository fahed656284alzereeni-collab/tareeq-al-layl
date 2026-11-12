insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mersal-support-attachments', 'mersal-support-attachments', false, 20971520,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf','video/mp4','video/quicktime'])
on conflict (id) do update set public=false, file_size_limit=20971520, allowed_mime_types=excluded.allowed_mime_types;

alter table public.support_requests
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text;

create policy "Support attachment owner and developer can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'mersal-support-attachments'
  and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (select auth.uid()) = '62fa5885-8d7c-4379-95e6-a8031e4f73ab'::uuid)
);
create policy "Users upload own support attachments"
on storage.objects for insert to authenticated
with check (bucket_id = 'mersal-support-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users remove own support attachments"
on storage.objects for delete to authenticated
using (bucket_id = 'mersal-support-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
