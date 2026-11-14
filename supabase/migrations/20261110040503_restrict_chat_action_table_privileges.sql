
revoke all on table public.user_blocks from authenticated;
revoke all on table public.conversation_hidden_for from authenticated;
grant select, insert, delete on table public.user_blocks to authenticated;
grant select, insert, delete on table public.conversation_hidden_for to authenticated;
