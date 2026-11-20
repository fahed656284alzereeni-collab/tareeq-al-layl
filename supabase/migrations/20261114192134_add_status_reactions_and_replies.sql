create table if not exists public.status_reactions (
  status_id uuid not null references public.statuses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🙏')),
  created_at timestamptz not null default now(),
  primary key (status_id, user_id)
);
create index if not exists status_reactions_status_idx on public.status_reactions(status_id);

create table if not exists public.status_replies (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.statuses(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists status_replies_status_created_idx on public.status_replies(status_id, created_at);

alter table public.status_reactions enable row level security;
alter table public.status_replies enable row level security;

revoke all on table public.status_reactions from anon, authenticated;
revoke all on table public.status_replies from anon, authenticated;
grant select, insert, update (emoji), delete on public.status_reactions to authenticated;
grant select, insert, delete on public.status_replies to authenticated;

drop policy if exists status_reactions_select_visible on public.status_reactions;
create policy status_reactions_select_visible on public.status_reactions
for select to authenticated using (
  exists (
    select 1 from public.statuses s
    where s.id = status_reactions.status_id
      and (s.user_id = (select auth.uid()) or private.can_view_status_item(s.id, (select auth.uid())))
  )
);

drop policy if exists status_reactions_insert_visible on public.status_reactions;
create policy status_reactions_insert_visible on public.status_reactions
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.statuses s
    where s.id = status_reactions.status_id
      and s.user_id <> (select auth.uid())
      and s.expires_at > now()
      and private.can_view_status_item(s.id, (select auth.uid()))
  )
);

drop policy if exists status_reactions_update_own on public.status_reactions;
create policy status_reactions_update_own on public.status_reactions
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.statuses s
    where s.id = status_reactions.status_id
      and s.user_id <> (select auth.uid())
      and s.expires_at > now()
      and private.can_view_status_item(s.id, (select auth.uid()))
  )
);

drop policy if exists status_reactions_delete_own on public.status_reactions;
create policy status_reactions_delete_own on public.status_reactions
for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists status_replies_select_author_or_owner on public.status_replies;
create policy status_replies_select_author_or_owner on public.status_replies
for select to authenticated using (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.statuses s
    where s.id = status_replies.status_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists status_replies_insert_visible on public.status_replies;
create policy status_replies_insert_visible on public.status_replies
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.statuses s
    where s.id = status_replies.status_id
      and s.user_id <> (select auth.uid())
      and s.expires_at > now()
      and private.can_view_status_item(s.id, (select auth.uid()))
  )
);

drop policy if exists status_replies_delete_author_or_owner on public.status_replies;
create policy status_replies_delete_author_or_owner on public.status_replies
for delete to authenticated using (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.statuses s
    where s.id = status_replies.status_id and s.user_id = (select auth.uid())
  )
);
