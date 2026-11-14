alter table public.messages
  add column if not exists view_once boolean not null default false;
grant select (view_once) on public.messages to authenticated;
grant insert (view_once) on public.messages to authenticated;

create table if not exists public.message_view_once_views (
  message_id uuid not null references public.messages(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (message_id, viewer_id)
);
create index if not exists message_view_once_views_viewer_idx
  on public.message_view_once_views(viewer_id, viewed_at desc);

alter table public.message_view_once_views enable row level security;

drop policy if exists message_view_once_select_sender_or_viewer on public.message_view_once_views;
create policy message_view_once_select_sender_or_viewer on public.message_view_once_views
for select to authenticated using (
  viewer_id = (select auth.uid())
  or exists (select 1 from public.messages m
    where m.id = message_view_once_views.message_id and m.sender_id = (select auth.uid()))
);

drop policy if exists message_view_once_insert_recipient_once on public.message_view_once_views;
create policy message_view_once_insert_recipient_once on public.message_view_once_views
for insert to authenticated with check (
  viewer_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_view_once_views.message_id
      and m.view_once = true
      and m.sender_id <> (select auth.uid())
      and (
        (not c.is_group and (c.user_one = (select auth.uid()) or c.user_two = (select auth.uid())))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        ))
      )
  )
);

grant select, insert on public.message_view_once_views to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_view_once_views'
  ) then
    alter publication supabase_realtime add table public.message_view_once_views;
  end if;
end $$;