create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communities_public_updated_idx on public.communities(is_public, updated_at desc);
create index if not exists communities_owner_updated_idx on public.communities(owner_id, updated_at desc);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on public.community_members(user_id, joined_at desc);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_deleted boolean not null default false
);
create index if not exists community_posts_community_created_idx on public.community_posts(community_id, created_at desc);

alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;

drop policy if exists communities_select_public_or_owner on public.communities;
create policy communities_select_public_or_owner on public.communities
for select to authenticated using (is_public or owner_id = (select auth.uid()));
drop policy if exists communities_insert_owner on public.communities;
create policy communities_insert_owner on public.communities
for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists communities_update_owner on public.communities;
create policy communities_update_owner on public.communities
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
drop policy if exists communities_delete_owner on public.communities;
create policy communities_delete_owner on public.communities
for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists community_members_select_self_or_owner on public.community_members;
create policy community_members_select_self_or_owner on public.community_members
for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.communities c
    where c.id = community_members.community_id and c.owner_id = (select auth.uid()))
);
drop policy if exists community_members_insert_self on public.community_members;
create policy community_members_insert_self on public.community_members
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.communities c
    where c.id = community_members.community_id and c.is_public and c.owner_id <> (select auth.uid()))
);
drop policy if exists community_members_delete_self_or_owner on public.community_members;
create policy community_members_delete_self_or_owner on public.community_members
for delete to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from public.communities c
    where c.id = community_members.community_id and c.owner_id = (select auth.uid()))
);

drop policy if exists community_posts_select_members on public.community_posts;
create policy community_posts_select_members on public.community_posts
for select to authenticated using (
  exists (select 1 from public.communities c
    where c.id = community_posts.community_id
      and (c.owner_id = (select auth.uid())
        or exists (select 1 from public.community_members m
          where m.community_id = c.id and m.user_id = (select auth.uid()))))
);
drop policy if exists community_posts_insert_owner on public.community_posts;
create policy community_posts_insert_owner on public.community_posts
for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.communities c
    where c.id = community_posts.community_id and c.owner_id = (select auth.uid()))
);
drop policy if exists community_posts_update_owner on public.community_posts;
create policy community_posts_update_owner on public.community_posts
for update to authenticated using (
  author_id = (select auth.uid())
  and exists (select 1 from public.communities c
    where c.id = community_posts.community_id and c.owner_id = (select auth.uid()))
) with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.communities c
    where c.id = community_posts.community_id and c.owner_id = (select auth.uid()))
);
drop policy if exists community_posts_delete_owner on public.community_posts;
create policy community_posts_delete_owner on public.community_posts
for delete to authenticated using (
  author_id = (select auth.uid())
  and exists (select 1 from public.communities c
    where c.id = community_posts.community_id and c.owner_id = (select auth.uid()))
);

grant select, insert, update, delete on public.communities to authenticated;
grant select, insert, delete on public.community_members to authenticated;
grant select, insert, update, delete on public.community_posts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_posts'
  ) then
    alter publication supabase_realtime add table public.community_posts;
  end if;
end $$;