
drop trigger if exists statuses_capture_audience on public.statuses;

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
    where i.owner_id = new.user_id
      and private.is_mersal_contact(new.user_id, i.included_user_id)
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = new.user_id and b.blocked_id = i.included_user_id)
           or (b.blocker_id = i.included_user_id and b.blocked_id = new.user_id)
      );
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

drop policy if exists status_privacy_inclusions_insert_own on public.status_privacy_inclusions;
create policy status_privacy_inclusions_insert_own
on public.status_privacy_inclusions
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and private.is_mersal_contact(owner_id, included_user_id)
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = owner_id and b.blocked_id = included_user_id)
       or (b.blocker_id = included_user_id and b.blocked_id = owner_id)
  )
);
