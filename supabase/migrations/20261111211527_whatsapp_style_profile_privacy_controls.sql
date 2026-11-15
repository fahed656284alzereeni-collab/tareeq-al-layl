
alter table public.privacy_settings
  add column if not exists profile_photo_visibility text not null default 'everyone',
  add column if not exists about_visibility text not null default 'everyone';

alter table public.profiles
  add column if not exists about text not null default '';

alter table public.profiles
  drop constraint if exists profiles_about_length_check;
alter table public.profiles
  add constraint profiles_about_length_check check (char_length(about) <= 139);

alter table public.privacy_exclusions
  drop constraint if exists privacy_exclusions_setting_key_check;
alter table public.privacy_exclusions
  add constraint privacy_exclusions_setting_key_check
  check (setting_key = any (array['last_seen','group_add','profile_photo','about']::text[]));

alter table public.privacy_settings
  drop constraint if exists privacy_settings_profile_photo_visibility_check;
alter table public.privacy_settings
  add constraint privacy_settings_profile_photo_visibility_check
  check (profile_photo_visibility = any (array['everyone','contacts','contacts_except','nobody']::text[]));

alter table public.privacy_settings
  drop constraint if exists privacy_settings_about_visibility_check;
alter table public.privacy_settings
  add constraint privacy_settings_about_visibility_check
  check (about_visibility = any (array['everyone','contacts','contacts_except','nobody']::text[]));

-- WhatsApp offers Everyone, My contacts, and My contacts except for group invitations.
-- Preserve existing "Nobody" choices by excluding all current Mersal contacts.
insert into public.privacy_exclusions(owner_id,excluded_user_id,setting_key)
select ps.user_id,
       case when c.user_one=ps.user_id then c.user_two else c.user_one end,
       'group_add'
from public.privacy_settings ps
join public.conversations c on not c.is_group
 and (c.user_one=ps.user_id or c.user_two=ps.user_id)
where ps.group_add_visibility='nobody'
on conflict(owner_id,excluded_user_id,setting_key) do nothing;

update public.privacy_settings set group_add_visibility='contacts_except'
where group_add_visibility='nobody';

alter table public.privacy_settings
  drop constraint if exists privacy_settings_group_add_visibility_check;
alter table public.privacy_settings
  add constraint privacy_settings_group_add_visibility_check
  check (group_add_visibility = any (array['everyone','contacts','contacts_except']::text[]));

-- Profile photo and About are served only through a privacy-aware RPC.
revoke select (avatar_url, about) on public.profiles from authenticated;
grant update (about) on public.profiles to authenticated;

create or replace function public.get_visible_profiles(p_user_ids uuid[] default null)
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
    and (p_user_ids is null or p.id=any(p_user_ids));
$function$;

revoke all on function public.get_visible_profiles(uuid[]) from public;
revoke all on function public.get_visible_profiles(uuid[]) from anon;
grant execute on function public.get_visible_profiles(uuid[]) to authenticated;
