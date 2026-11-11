alter table public.privacy_settings
  alter column last_seen_visibility set default 'contacts',
  alter column online_visibility set default 'everyone';

create or replace function private.can_view_user_presence(p_target_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null or p_target_user_id is null then false
    when p_target_user_id = (select auth.uid()) then true
    when exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_target_user_id)
         or (b.blocker_id = p_target_user_id and b.blocked_id = (select auth.uid()))
    ) then false
    when not private.visibility_allows(
      (select auth.uid()), p_target_user_id,
      coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id = (select auth.uid())), 'contacts'),
      'last_seen'
    ) then false
    when not (
      case coalesce((select ps.online_visibility from public.privacy_settings ps where ps.user_id = (select auth.uid())), 'everyone')
        when 'everyone' then true
        when 'same_as_last_seen' then private.visibility_allows(
          (select auth.uid()), p_target_user_id,
          coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id = (select auth.uid())), 'contacts'),
          'last_seen'
        )
        else false
      end
    ) then false
    when p_kind = 'last_seen' then private.visibility_allows(
      p_target_user_id, (select auth.uid()),
      coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id = p_target_user_id), 'contacts'),
      'last_seen'
    )
    when p_kind = 'online' then
      case coalesce((select ps.online_visibility from public.privacy_settings ps where ps.user_id = p_target_user_id), 'everyone')
        when 'everyone' then true
        when 'same_as_last_seen' then private.visibility_allows(
          p_target_user_id, (select auth.uid()),
          coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id = p_target_user_id), 'contacts'),
          'last_seen'
        )
        else false
      end
    else false
  end;
$function$;

create or replace function private.snapshot_status_audience()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_scope text;
  v_audience uuid[];
begin
  if (select auth.uid()) is not null and new.user_id <> (select auth.uid()) then
    raise exception 'لا يمكنك نشر حالة باسم مستخدم آخر';
  end if;

  select coalesce(ps.status_visibility, 'contacts')
    into v_scope
  from public.privacy_settings ps
  where ps.user_id = new.user_id;

  v_scope := coalesce(v_scope, 'contacts');

  if v_scope = 'only_share' then
    select coalesce(array_agg(i.included_user_id), '{}'::uuid[])
      into v_audience
    from public.status_privacy_inclusions i
    where i.owner_id = new.user_id;
  elsif v_scope = 'nobody' then
    v_audience := '{}'::uuid[];
  else
    select coalesce(array_agg(p.id), '{}'::uuid[])
      into v_audience
    from public.profiles p
    where p.id <> new.user_id
      and private.is_mersal_contact(new.user_id, p.id)
      and (
        v_scope = 'contacts'
        or (
          v_scope in ('contacts_except', 'custom')
          and not exists (
            select 1 from public.status_privacy_exclusions e
            where e.owner_id = new.user_id
              and e.excluded_user_id = p.id
          )
        )
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = new.user_id and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = new.user_id)
      );
  end if;

  new.audience_user_ids := coalesce(v_audience, '{}'::uuid[]);
  return new;
end;
$function$;

drop trigger if exists statuses_snapshot_audience on public.statuses;
create trigger statuses_snapshot_audience
before insert on public.statuses
for each row execute function private.snapshot_status_audience();

-- Existing active statuses keep the audience they were visible to at migration time.
update public.statuses s
set audience_user_ids = case
  when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts')='only_share'
    then coalesce((select array_agg(i.included_user_id) from public.status_privacy_inclusions i where i.owner_id=s.user_id),'{}'::uuid[])
  when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts')='nobody'
    then '{}'::uuid[]
  else coalesce((
    select array_agg(p.id)
    from public.profiles p
    where p.id<>s.user_id
      and private.is_mersal_contact(s.user_id,p.id)
      and (
        coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts')='contacts'
        or (
          coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=s.user_id),'contacts') in ('contacts_except','custom')
          and not exists(select 1 from public.status_privacy_exclusions e where e.owner_id=s.user_id and e.excluded_user_id=p.id)
        )
      )
      and not exists(select 1 from public.user_blocks b where
        (b.blocker_id=s.user_id and b.blocked_id=p.id) or (b.blocker_id=p.id and b.blocked_id=s.user_id))
  ),'{}'::uuid[])
end
where s.expires_at>now() and s.audience_user_ids is null;
