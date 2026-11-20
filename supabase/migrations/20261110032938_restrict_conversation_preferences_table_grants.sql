
revoke all on table public.conversation_preferences from anon, authenticated;
grant select, insert, update on table public.conversation_preferences to authenticated;
