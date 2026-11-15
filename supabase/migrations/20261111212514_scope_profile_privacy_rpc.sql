
create or replace function private.get_visible_profiles(p_user_ids uuid[])
returns table(id uuid, display_name text, avatar_url text, about text)
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id,
         p.display_name,
         case when p.id=(select auth.uid()) or private.visibility_allows(
           p.id,(select auth.uid()),
           coalesce(ps.profile_photo_visibility,'everyone'),'profile_photo'
         ) then p.avatar_url else null end,
         case when p.id=(select auth.uid()) or private.visibility_allows(
           p.id,(select auth.uid()),
           coalesce(ps.about_visibility,'everyone'),'about'
         ) then p.about else null end
  from public.profiles p
  left join public.privacy_settings ps on ps.user_id=p.id
  where (select auth.uid()) is not null
    and p_user_ids is not null
    and p.id=any(p_user_ids);
$function$;

revoke all on function private.get_visible_profiles(uuid[]) from public;
revoke all on function private.get_visible_profiles(uuid[]) from anon;
grant usage on schema private to authenticated;
grant execute on function private.get_visible_profiles(uuid[]) to authenticated;

drop function if exists public.get_visible_profiles(uuid[]);
create function public.get_visible_profiles(p_user_ids uuid[])
returns table(id uuid, display_name text, avatar_url text, about text)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from private.get_visible_profiles(p_user_ids);
$function$;

revoke all on function public.get_visible_profiles(uuid[]) from public;
revoke all on function public.get_visible_profiles(uuid[]) from anon;
grant execute on function public.get_visible_profiles(uuid[]) to authenticated;
