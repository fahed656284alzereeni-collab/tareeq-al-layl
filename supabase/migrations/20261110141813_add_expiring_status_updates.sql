
create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text','image','video')),
  content text,
  media_path text unique,
  media_type text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint statuses_content_length check (content is null or char_length(content) <= 700),
  constraint statuses_payload_check check (
    (kind = 'text' and content is not null and char_length(btrim(content)) between 1 and 700 and media_path is null and media_type is null)
    or
    (kind in ('image','video') and media_path is not null and media_type is not null)
  ),
  constraint statuses_expiry_window check (expires_at > created_at and expires_at <= created_at + interval '24 hours 5 minutes')
);

create index if not exists statuses_active_created_idx on public.statuses (expires_at desc, created_at desc);
create index if not exists statuses_user_active_idx on public.statuses (user_id, expires_at desc);

create table if not exists public.status_views (
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);
create index if not exists status_views_viewer_idx on public.status_views (viewer_id, viewed_at desc);

alter table public.statuses enable row level security;
alter table public.status_views enable row level security;

drop policy if exists "status_read_active_unblocked" on public.statuses;
create policy "status_read_active_unblocked"
on public.statuses for select to authenticated
using (
  expires_at > now()
  and (
    user_id = (select auth.uid())
    or not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = statuses.user_id)
         or (b.blocker_id = statuses.user_id and b.blocked_id = (select auth.uid()))
    )
  )
);

drop policy if exists "status_insert_own" on public.statuses;
create policy "status_insert_own"
on public.statuses for insert to authenticated
with check (
  user_id = (select auth.uid())
  and created_at <= now() + interval '1 minute'
  and expires_at > now()
  and expires_at <= now() + interval '24 hours 5 minutes'
);

drop policy if exists "status_delete_own" on public.statuses;
create policy "status_delete_own"
on public.statuses for delete to authenticated
using (user_id = (select auth.uid()));

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
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = s.user_id)
           or (b.blocker_id = s.user_id and b.blocked_id = (select auth.uid()))
      )
  )
);

drop policy if exists "status_views_owner_read" on public.status_views;
create policy "status_views_owner_read"
on public.status_views for select to authenticated
using (
  exists (
    select 1 from public.statuses s
    where s.id = status_views.status_id and s.user_id = (select auth.uid())
  )
);

revoke all on public.statuses from anon, public;
revoke all on public.status_views from anon, public;
grant select, insert, delete on public.statuses to authenticated;
grant select, insert on public.status_views to authenticated;

drop policy if exists "mersal_status_upload_as_owner" on storage.objects;
create policy "mersal_status_upload_as_owner"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mersal-attachments'
  and (storage.foldername(name))[1] = 'statuses'
  and (storage.foldername(name))[2] = (select auth.uid())::text
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
        or not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id = (select auth.uid()) and b.blocked_id = s.user_id)
             or (b.blocker_id = s.user_id and b.blocked_id = (select auth.uid()))
        )
      )
  )
);

drop policy if exists "mersal_status_delete_as_owner" on storage.objects;
create policy "mersal_status_delete_as_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mersal-attachments'
  and (storage.foldername(name))[1] = 'statuses'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
