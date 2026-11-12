revoke all on table public.support_requests from anon, authenticated;
revoke all on table public.support_request_messages from anon, authenticated;
grant select, insert, update on table public.support_requests to authenticated;
grant select, insert on table public.support_request_messages to authenticated;
