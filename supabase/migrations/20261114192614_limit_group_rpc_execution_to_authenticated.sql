revoke execute on function public.get_group_invite_preview(uuid) from public, anon;
revoke execute on function public.get_or_create_group_invite(uuid) from public, anon;
revoke execute on function public.get_profile_join_date(uuid) from public, anon;
revoke execute on function public.join_group_by_invite(uuid) from public, anon;
revoke execute on function public.list_group_join_requests(uuid) from public, anon;
revoke execute on function public.request_group_join_by_invite(uuid) from public, anon;
revoke execute on function public.reset_group_invite(uuid) from public, anon;
revoke execute on function public.review_group_join_request(uuid, boolean) from public, anon;

grant execute on function public.get_group_invite_preview(uuid) to authenticated;
grant execute on function public.get_or_create_group_invite(uuid) to authenticated;
grant execute on function public.get_profile_join_date(uuid) to authenticated;
grant execute on function public.join_group_by_invite(uuid) to authenticated;
grant execute on function public.list_group_join_requests(uuid) to authenticated;
grant execute on function public.request_group_join_by_invite(uuid) to authenticated;
grant execute on function public.reset_group_invite(uuid) to authenticated;
grant execute on function public.review_group_join_request(uuid, boolean) to authenticated;
