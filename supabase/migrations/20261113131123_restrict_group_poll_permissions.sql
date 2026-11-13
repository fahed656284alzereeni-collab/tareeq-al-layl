revoke all on table public.group_polls from anon, public, authenticated;
revoke all on table public.group_poll_votes from anon, public, authenticated;
grant select, insert, delete on table public.group_polls to authenticated;
grant select, insert, update on table public.group_poll_votes to authenticated;