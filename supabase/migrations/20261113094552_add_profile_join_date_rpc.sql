create or replace function public.get_profile_join_date(p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $function$
  select p.created_at
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id = p_user_id;
$function$;

revoke all on function public.get_profile_join_date(uuid) from public;
grant execute on function public.get_profile_join_date(uuid) to authenticated;
