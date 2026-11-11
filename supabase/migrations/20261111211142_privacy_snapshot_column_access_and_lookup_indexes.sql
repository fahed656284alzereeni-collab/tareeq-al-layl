create index if not exists privacy_exclusions_owner_setting_idx on public.privacy_exclusions(owner_id,setting_key);
create index if not exists status_privacy_inclusions_owner_idx on public.status_privacy_inclusions(owner_id);
create index if not exists message_reads_user_id_idx on public.message_reads(user_id);
create index if not exists privacy_exclusions_excluded_user_id_idx on public.privacy_exclusions(excluded_user_id);
create index if not exists status_privacy_exclusions_excluded_user_id_idx on public.status_privacy_exclusions(excluded_user_id);
create index if not exists status_privacy_inclusions_included_user_id_idx on public.status_privacy_inclusions(included_user_id);

revoke select on table public.statuses from authenticated;
grant select (id,user_id,kind,content,media_path,media_type,created_at,expires_at)
on table public.statuses to authenticated;
revoke all (audience_user_ids) on table public.statuses from authenticated;

update public.statuses s
set audience_user_ids = case
  when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts') in ('contacts','everyone') then
    (select coalesce(array_agg(distinct case when c.user_one=s.user_id then c.user_two else c.user_one end),array[]::uuid[])
     from public.conversations c where c.is_group=false and (c.user_one=s.user_id or c.user_two=s.user_id))
  when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts') in ('contacts_except','custom') then
    (select coalesce(array_agg(distinct x.other_id),array[]::uuid[])
     from (select case when c.user_one=s.user_id then c.user_two else c.user_one end as other_id
       from public.conversations c where c.is_group=false and (c.user_one=s.user_id or c.user_two=s.user_id)) x
     where not exists(select 1 from public.status_privacy_exclusions e where e.owner_id=s.user_id and e.excluded_user_id=x.other_id))
  when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts')='only_share' then
    (select coalesce(array_agg(i.included_user_id),array[]::uuid[]) from public.status_privacy_inclusions i where i.owner_id=s.user_id)
  else array[]::uuid[]
end
where s.audience_user_ids is null;
