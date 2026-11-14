
revoke all on table public.user_blocks from anon;
revoke all on table public.conversation_hidden_for from anon;
grant select, insert, delete on table public.user_blocks to authenticated;
grant select, insert, delete on table public.conversation_hidden_for to authenticated;
