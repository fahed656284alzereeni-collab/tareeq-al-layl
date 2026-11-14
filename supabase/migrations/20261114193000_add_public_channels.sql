create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists channels_public_updated_idx on public.channels(is_public, updated_at desc);
create index if not exists channels_owner_updated_idx on public.channels(owner_id, updated_at desc);

create table if not exists public.channel_followers (
  channel_id uuid not null references public.channels(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (channel_id, follower_id)
);
create index if not exists channel_followers_user_idx on public.channel_followers(follower_id, created_at desc);

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  is_deleted boolean not null default false
);
create index if not exists channel_posts_channel_created_idx on public.channel_posts(channel_id, created_at desc);

alter table public.channels enable row level security;
alter table public.channel_followers enable row level security;
alter table public.channel_posts enable row level security;

drop policy if exists channels_select_public_or_owner on public.channels;
create policy channels_select_public_or_owner on public.channels
for select to authenticated using (is_public or owner_id = (select auth.uid()));

drop policy if exists channels_insert_owner on public.channels;
create policy channels_insert_owner on public.channels
for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists channels_update_owner on public.channels;
create policy channels_update_owner on public.channels
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists channels_delete_owner on public.channels;
create policy channels_delete_owner on public.channels
for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists channel_followers_select_self_or_owner on public.channel_followers;
create policy channel_followers_select_self_or_owner on public.channel_followers
for select to authenticated using (
  follower_id = (select auth.uid())
  or exists (select 1 from public.channels c
    where c.id = channel_followers.channel_id and c.owner_id = (select auth.uid()))
);

drop policy if exists channel_followers_insert_self on public.channel_followers;
create policy channel_followers_insert_self on public.channel_followers
for insert to authenticated with check (
  follower_id = (select auth.uid())
  and exists (select 1 from public.channels c
    where c.id = channel_followers.channel_id and c.is_public and c.owner_id <> (select auth.uid()))
);

drop policy if exists channel_followers_update_self on public.channel_followers;
create policy channel_followers_update_self on public.channel_followers
for update to authenticated using (follower_id = (select auth.uid()))
with check (follower_id = (select auth.uid()));

drop policy if exists channel_followers_delete_self_or_owner on public.channel_followers;
create policy channel_followers_delete_self_or_owner on public.channel_followers
for delete to authenticated using (
  follower_id = (select auth.uid())
  or exists (select 1 from public.channels c
    where c.id = channel_followers.channel_id and c.owner_id = (select auth.uid()))
);

drop policy if exists channel_posts_select_visible on public.channel_posts;
create policy channel_posts_select_visible on public.channel_posts
for select to authenticated using (
  exists (select 1 from public.channels c
    where c.id = channel_posts.channel_id
      and (c.is_public or c.owner_id = (select auth.uid())
        or exists (select 1 from public.channel_followers f
          where f.channel_id = c.id and f.follower_id = (select auth.uid()))))
);

drop policy if exists channel_posts_insert_owner on public.channel_posts;
create policy channel_posts_insert_owner on public.channel_posts
for insert to authenticated with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.channels c
    where c.id = channel_posts.channel_id and c.owner_id = (select auth.uid()))
);

drop policy if exists channel_posts_update_owner on public.channel_posts;
create policy channel_posts_update_owner on public.channel_posts
for update to authenticated using (
  author_id = (select auth.uid())
  and exists (select 1 from public.channels c
    where c.id = channel_posts.channel_id and c.owner_id = (select auth.uid()))
) with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.channels c
    where c.id = channel_posts.channel_id and c.owner_id = (select auth.uid()))
);

drop policy if exists channel_posts_delete_owner on public.channel_posts;
create policy channel_posts_delete_owner on public.channel_posts
for delete to authenticated using (
  author_id = (select auth.uid())
  and exists (select 1 from public.channels c
    where c.id = channel_posts.channel_id and c.owner_id = (select auth.uid()))
);

grant select, insert, update, delete on public.channels to authenticated;
revoke update on public.channel_followers from authenticated;
grant update (notifications_enabled) on public.channel_followers to authenticated;
grant select, insert, delete on public.channel_followers to authenticated;
grant select, insert, update, delete on public.channel_posts to authenticated;
