alter table public.privacy_settings drop constraint if exists privacy_settings_last_seen_visibility_check;
alter table public.privacy_settings drop constraint if exists privacy_settings_online_visibility_check;
alter table public.privacy_settings drop constraint if exists privacy_settings_group_add_visibility_check;
alter table public.privacy_settings drop constraint if exists privacy_settings_status_visibility_check;

update public.privacy_settings
set last_seen_visibility=case
  when online_visibility='nobody' then 'nobody'
  when online_visibility='contacts' and last_seen_visibility='everyone' then 'contacts'
  else last_seen_visibility
end,
online_visibility='same_as_last_seen'
where online_visibility in ('contacts','nobody');

update public.privacy_settings set status_visibility='contacts_except' where status_visibility='custom';
update public.privacy_settings set status_visibility='contacts' where status_visibility='everyone';

alter table public.privacy_settings add constraint privacy_settings_last_seen_visibility_check
check (last_seen_visibility in ('everyone','contacts','contacts_except','nobody'));
alter table public.privacy_settings add constraint privacy_settings_online_visibility_check
check (online_visibility in ('everyone','same_as_last_seen'));
alter table public.privacy_settings add constraint privacy_settings_group_add_visibility_check
check (group_add_visibility in ('everyone','contacts','contacts_except','nobody'));
alter table public.privacy_settings add constraint privacy_settings_status_visibility_check
check (status_visibility in ('contacts','contacts_except','only_share','nobody'));
