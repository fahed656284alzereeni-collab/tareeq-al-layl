alter table public.conversations
  add column if not exists group_description text,
  add column if not exists group_photo_path text;

alter table public.conversations
  drop constraint if exists conversations_group_description_length_check;
alter table public.conversations
  add constraint conversations_group_description_length_check
  check (group_description is null or char_length(group_description) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mersal-group-photos', 'mersal-group-photos', false, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mersal_group_photo_read_members on storage.objects;
create policy mersal_group_photo_read_members
on storage.objects for select to authenticated
using (
  bucket_id = 'mersal-group-photos'
  and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and c.is_group
      and (
        c.user_one = (select auth.uid())
        or exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id
            and cm.user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists mersal_group_photo_insert_owner on storage.objects;
create policy mersal_group_photo_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mersal-group-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and c.is_group
      and c.user_one = (select auth.uid())
  )
);

drop policy if exists mersal_group_photo_delete_owner on storage.objects;
create policy mersal_group_photo_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'mersal-group-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1 from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and c.is_group
      and c.user_one = (select auth.uid())
  )
);
