create index if not exists group_polls_created_by_idx on public.group_polls(created_by);
create index if not exists group_poll_votes_user_id_idx on public.group_poll_votes(user_id);
revoke all on table public.group_polls from anon, public;
revoke all on table public.group_poll_votes from anon, public;
grant select, insert, delete on table public.group_polls to authenticated;
grant select, insert, update on table public.group_poll_votes to authenticated;