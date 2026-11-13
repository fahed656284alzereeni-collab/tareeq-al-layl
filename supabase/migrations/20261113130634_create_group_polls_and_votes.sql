
create table public.group_polls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 240),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create index group_polls_conversation_created_idx on public.group_polls (conversation_id, created_at desc);
create table public.group_poll_votes (
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index group_poll_votes_poll_idx on public.group_poll_votes (poll_id);
alter table public.group_polls enable row level security;
alter table public.group_poll_votes enable row level security;
grant select, insert, delete on public.group_polls to authenticated;
grant select, insert, update, delete on public.group_poll_votes to authenticated;
create policy "group_polls_select_members" on public.group_polls for select to authenticated
using (private.is_group_member(conversation_id));
create policy "group_polls_insert_members" on public.group_polls for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_group_member(conversation_id));
create policy "group_polls_delete_creator" on public.group_polls for delete to authenticated
using (created_by = (select auth.uid()));
create policy "group_poll_votes_select_members" on public.group_poll_votes for select to authenticated
using (exists (select 1 from public.group_polls p where p.id = poll_id and private.is_group_member(p.conversation_id)));
create policy "group_poll_votes_insert_self" on public.group_poll_votes for insert to authenticated
with check (user_id = (select auth.uid()) and exists (select 1 from public.group_polls p where p.id = poll_id and private.is_group_member(p.conversation_id)));
create policy "group_poll_votes_update_self" on public.group_poll_votes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (select 1 from public.group_polls p where p.id = poll_id and private.is_group_member(p.conversation_id)));
create or replace function private.validate_group_poll_vote()
returns trigger language plpgsql set search_path = public, private, pg_temp as $$
declare poll_options jsonb; poll_closes_at timestamptz;
begin
  if new.user_id <> (select auth.uid()) then raise exception 'You can only vote as yourself'; end if;
  select options, closes_at into poll_options, poll_closes_at from public.group_polls where id = new.poll_id;
  if poll_options is null then raise exception 'Poll not found or access denied'; end if;
  if new.option_index >= jsonb_array_length(poll_options) then raise exception 'Invalid poll option'; end if;
  if poll_closes_at is not null and poll_closes_at <= now() then raise exception 'Poll is closed'; end if;
  return new;
end;
$$;
create trigger validate_group_poll_vote_before_write before insert or update on public.group_poll_votes
for each row execute function private.validate_group_poll_vote();
