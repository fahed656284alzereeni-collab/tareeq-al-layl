drop policy if exists group_join_requests_deny_direct_access on public.group_join_requests;
create policy group_join_requests_deny_direct_access
on public.group_join_requests
for all
to public
using (false)
with check (false);

comment on table public.group_join_requests is
  'Direct table access is denied by RLS; authenticated group-admin RPCs provide the only supported read/write path.';
