create table if not exists public.broadcast_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists broadcast_lists_owner_created_idx on public.broadcast_lists(owner_id, created_at desc);

create table if not exists public.broadcast_list_members (
  broadcast_list_id uuid not null references public.broadcast_lists(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (broadcast_list_id, recipient_id)
);
create index if not exists broadcast_list_members_recipient_idx on public.broadcast_list_members(recipient_id);

alter table public.broadcast_lists enable row level security;
alter table public.broadcast_list_members enable row level security;
revoke all on table public.broadcast_lists from anon, authenticated;
revoke all on table public.broadcast_list_members from anon, authenticated;
grant select, insert, update (name, updated_at), delete on public.broadcast_lists to authenticated;
grant select, insert, delete on public.broadcast_list_members to authenticated;

drop policy if exists broadcast_lists_select_owner on public.broadcast_lists;
create policy broadcast_lists_select_owner on public.broadcast_lists
for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists broadcast_lists_insert_owner on public.broadcast_lists;
create policy broadcast_lists_insert_owner on public.broadcast_lists
for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists broadcast_lists_update_owner on public.broadcast_lists;
create policy broadcast_lists_update_owner on public.broadcast_lists
for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists broadcast_lists_delete_owner on public.broadcast_lists;
create policy broadcast_lists_delete_owner on public.broadcast_lists
for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists broadcast_members_select_owner on public.broadcast_list_members;
create policy broadcast_members_select_owner on public.broadcast_list_members
for select to authenticated using (
  exists (select 1 from public.broadcast_lists b where b.id = broadcast_list_members.broadcast_list_id and b.owner_id = (select auth.uid()))
);
drop policy if exists broadcast_members_insert_owner on public.broadcast_list_members;
create policy broadcast_members_insert_owner on public.broadcast_list_members
for insert to authenticated with check (
  recipient_id <> (select auth.uid())
  and exists (select 1 from public.broadcast_lists b where b.id = broadcast_list_members.broadcast_list_id and b.owner_id = (select auth.uid()))
);
drop policy if exists broadcast_members_delete_owner on public.broadcast_list_members;
create policy broadcast_members_delete_owner on public.broadcast_list_members
for delete to authenticated using (
  exists (select 1 from public.broadcast_lists b where b.id = broadcast_list_members.broadcast_list_id and b.owner_id = (select auth.uid()))
);
