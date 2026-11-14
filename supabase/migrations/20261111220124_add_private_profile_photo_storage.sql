
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mersal-profile-photos','mersal-profile-photos',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists mersal_profile_photo_upload_own on storage.objects;
create policy mersal_profile_photo_upload_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'mersal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists mersal_profile_photo_delete_own on storage.objects;
create policy mersal_profile_photo_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'mersal-profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists mersal_profile_photo_read_visible on storage.objects;
create policy mersal_profile_photo_read_visible on storage.objects
for select to authenticated
using (
  bucket_id = 'mersal-profile-photos'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (
      (storage.foldername(name))[1]::uuid = (select auth.uid())
      or exists (
        select 1
        from public.profiles p
        left join public.privacy_settings ps on ps.user_id = p.id
        where p.id = (storage.foldername(name))[1]::uuid
          and private.visibility_allows(
            p.id,
            (select auth.uid()),
            coalesce(ps.profile_photo_visibility, 'everyone'),
            'profile_photo'
          )
      )
    )
    else false
  end
);
