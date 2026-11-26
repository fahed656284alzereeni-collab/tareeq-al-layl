create table if not exists public.community_groups (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  group_name text not null check (char_length(btrim(group_name)) between 1 and 100),
  invite_token uuid not null,
  created_at timestamptz not null default now(),
  unique (community_id, conversation_id)
);
create index if not exists community_groups_community_created_idx
  on public.community_groups(community_id, created_at);

alter table public.community_groups enable row level security;

drop policy if exists community_groups_select_members on public.community_groups;
create policy community_groups_select_members on public.community_groups
for select to authenticated using (
  exists (select 1 from public.communities c
    where c.id = community_groups.community_id
      and (c.owner_id = (select auth.uid())
        or exists (select 1 from public.community_members m
          where m.community_id = c.id and m.user_id = (select auth.uid()))))
);

drop policy if exists community_groups_insert_owner_group_admin on public.community_groups;
create policy community_groups_insert_owner_group_admin on public.community_groups
for insert to authenticated with check (
  added_by = (select auth.uid())
  and exists (select 1 from public.communities c
    where c.id = community_groups.community_id and c.owner_id = (select auth.uid()))
  and exists (select 1 from public.conversations conv
    join public.conversation_members cm on cm.conversation_id = conv.id
    where conv.id = community_groups.conversation_id
      and conv.is_group = true
      and cm.user_id = (select auth.uid())
      and cm.role = 'admin')
);

drop policy if exists community_groups_delete_owner on public.community_groups;
create policy community_groups_delete_owner on public.community_groups
for delete to authenticated using (
  exists (select 1 from public.communities c
    where c.id = community_groups.community_id and c.owner_id = (select auth.uid()))
);

grant select, insert, delete on public.community_groups to authenticated;
