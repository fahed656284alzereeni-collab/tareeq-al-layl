create or replace function public.list_group_join_requests(p_conversation_id uuid)
returns table(
  request_id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  requested_at timestamp with time zone
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_group_admin(p_conversation_id) then
    raise exception 'Group admin required';
  end if;

  return query
  select
    gjr.id,
    gjr.user_id,
    coalesce(nullif(btrim(p.display_name), ''), 'مستخدم مرسال'),
    visible_profile.avatar_url,
    gjr.requested_at
  from public.group_join_requests gjr
  left join public.profiles p on p.id = gjr.user_id
  left join lateral (
    select vp.avatar_url
    from private.get_visible_profiles(array[gjr.user_id]::uuid[]) vp
    limit 1
  ) visible_profile on true
  where gjr.conversation_id = p_conversation_id
    and gjr.status = 'pending'
  order by gjr.requested_at asc;
end;
$function$;
