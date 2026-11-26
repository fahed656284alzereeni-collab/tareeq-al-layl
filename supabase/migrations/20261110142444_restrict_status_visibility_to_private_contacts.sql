
drop policy if exists "status_read_active_unblocked" on public.statuses;
create policy "status_read_active_unblocked"
on public.statuses for select to authenticated
using (
  expires_at > now()
  and (
    user_id = (select auth.uid())
    or (
      exists (
        select 1 from public.conversations c
        where c.is_group = false
          and (
            (c.user_one = (select auth.uid()) and c.user_two = statuses.user_id)
            or (c.user_two = (select auth.uid()) and c.user_one = statuses.user_id)
          )
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = statuses.user_id)
           or (b.blocker_id = statuses.user_id and b.blocked_id = (select auth.uid()))
      )
    )
  )
);

drop policy if exists "status_views_insert_visible" on public.status_views;
create policy "status_views_insert_visible"
on public.status_views for insert to authenticated
with check (
  viewer_id = (select auth.uid())
  and exists (
    select 1 from public.statuses s
    where s.id = status_views.status_id
      and s.user_id <> (select auth.uid())
      and s.expires_at > now()
      and exists (
        select 1 from public.conversations c
        where c.is_group = false
          and (
            (c.user_one = (select auth.uid()) and c.user_two = s.user_id)
            or (c.user_two = (select auth.uid()) and c.user_one = s.user_id)
          )
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = s.user_id)
           or (b.blocker_id = s.user_id and b.blocked_id = (select auth.uid()))
      )
  )
);

drop policy if exists "mersal_status_read_active_visible" on storage.objects;
create policy "mersal_status_read_active_visible"
on storage.objects for select to authenticated
using (
  bucket_id = 'mersal-attachments'
  and (storage.foldername(name))[1] = 'statuses'
  and exists (
    select 1 from public.statuses s
    where s.media_path = objects.name
      and s.expires_at > now()
      and (
        s.user_id = (select auth.uid())
        or (
          exists (
            select 1 from public.conversations c
            where c.is_group = false
              and (
                (c.user_one = (select auth.uid()) and c.user_two = s.user_id)
                or (c.user_two = (select auth.uid()) and c.user_one = s.user_id)
              )
          )
          and not exists (
            select 1 from public.user_blocks b
            where (b.blocker_id = (select auth.uid()) and b.blocked_id = s.user_id)
               or (b.blocker_id = s.user_id and b.blocked_id = (select auth.uid()))
          )
        )
      )
  )
);
