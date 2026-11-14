
create table if not exists public.privacy_exclusions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  excluded_user_id uuid not null references auth.users(id) on delete cascade,
  setting_key text not null check (setting_key in ('last_seen','group_add')),
  created_at timestamptz not null default now(),
  primary key (owner_id, excluded_user_id, setting_key),
  check (owner_id <> excluded_user_id)
);
alter table public.privacy_exclusions enable row level security;
drop policy if exists privacy_exclusions_select_own on public.privacy_exclusions;
create policy privacy_exclusions_select_own on public.privacy_exclusions for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists privacy_exclusions_insert_own on public.privacy_exclusions;
create policy privacy_exclusions_insert_own on public.privacy_exclusions for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy if exists privacy_exclusions_delete_own on public.privacy_exclusions;
create policy privacy_exclusions_delete_own on public.privacy_exclusions for delete to authenticated using (owner_id=(select auth.uid()));

create table if not exists public.status_privacy_inclusions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  included_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, included_user_id),
  check (owner_id <> included_user_id)
);
alter table public.status_privacy_inclusions enable row level security;
drop policy if exists status_privacy_inclusions_select_own on public.status_privacy_inclusions;
create policy status_privacy_inclusions_select_own on public.status_privacy_inclusions for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists status_privacy_inclusions_insert_own on public.status_privacy_inclusions;
create policy status_privacy_inclusions_insert_own on public.status_privacy_inclusions for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy if exists status_privacy_inclusions_delete_own on public.status_privacy_inclusions;
create policy status_privacy_inclusions_delete_own on public.status_privacy_inclusions for delete to authenticated using (owner_id=(select auth.uid()));

alter table public.statuses add column if not exists audience_user_ids uuid[];

update public.privacy_settings
set status_visibility='contacts'
where status_visibility='everyone';

create or replace function private.visibility_allows(
  p_owner_id uuid, p_viewer_id uuid, p_scope text, p_setting_key text
) returns boolean
language sql stable security definer set search_path=''
as $$
  select case
    when p_owner_id is null or p_viewer_id is null then false
    when p_owner_id=p_viewer_id then true
    when exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=p_owner_id and b.blocked_id=p_viewer_id)
         or (b.blocker_id=p_viewer_id and b.blocked_id=p_owner_id)
    ) then false
    when coalesce(p_scope,'everyone')='everyone' then true
    when coalesce(p_scope,'everyone')='contacts'
      then private.is_mersal_contact(p_owner_id,p_viewer_id)
    when coalesce(p_scope,'everyone')='contacts_except'
      then private.is_mersal_contact(p_owner_id,p_viewer_id)
       and not exists (
         select 1 from public.privacy_exclusions e
         where e.owner_id=p_owner_id and e.excluded_user_id=p_viewer_id
           and e.setting_key=p_setting_key
       )
    when coalesce(p_scope,'everyone')='nobody' then false
    else false
  end;
$$;
revoke all on function private.visibility_allows(uuid,uuid,text,text) from public, anon, authenticated;

create or replace function private.can_view_user_presence(p_target_user_id uuid, p_kind text)
returns boolean language sql stable security definer set search_path=''
as $$
  select case
    when (select auth.uid()) is null or p_target_user_id is null then false
    when p_target_user_id=(select auth.uid()) then true
    when exists (
      select 1 from public.user_blocks b where
        (b.blocker_id=(select auth.uid()) and b.blocked_id=p_target_user_id)
        or (b.blocker_id=p_target_user_id and b.blocked_id=(select auth.uid()))
    ) then false
    -- WhatsApp reciprocity: you must also share your own last-seen with this person.
    when not private.visibility_allows(
      (select auth.uid()), p_target_user_id,
      coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id=(select auth.uid())),'everyone'),
      'last_seen'
    ) then false
    when p_kind='last_seen' then private.visibility_allows(
      p_target_user_id,(select auth.uid()),
      coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone'),
      'last_seen'
    )
    when p_kind='online' then
      case coalesce((select ps.online_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone')
        when 'everyone' then true
        when 'same_as_last_seen' then private.visibility_allows(
          p_target_user_id,(select auth.uid()),
          coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone'),
          'last_seen'
        )
        when 'contacts' then private.is_mersal_contact(p_target_user_id,(select auth.uid()))
        when 'nobody' then false
        else false
      end
    else false
  end;
$$;
revoke all on function private.can_view_user_presence(uuid,text) from public, anon, authenticated;

create or replace function public.get_visible_presence()
returns table(user_id uuid,is_online boolean,last_seen_at timestamptz)
language sql stable security definer set search_path=''
as $$
  select p.id,
    (p.last_seen_at >= now()-interval '90 seconds')
      and private.can_view_user_presence(p.id,'online') as is_online,
    case when private.can_view_user_presence(p.id,'last_seen') then p.last_seen_at else null end
  from public.profiles p
  where p.id<>(select auth.uid())
    and (private.can_view_user_presence(p.id,'online') or private.can_view_user_presence(p.id,'last_seen'))
    and not exists (
      select 1 from public.user_blocks b where
        (b.blocker_id=(select auth.uid()) and b.blocked_id=p.id)
        or (b.blocker_id=p.id and b.blocked_id=(select auth.uid()))
    );
$$;
revoke all on function public.get_visible_presence() from public, anon;
grant execute on function public.get_visible_presence() to authenticated;

create or replace function private.can_add_user_to_group(p_target_user_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select case
    when (select auth.uid()) is null or p_target_user_id is null then false
    when p_target_user_id=(select auth.uid()) then true
    when exists (
      select 1 from public.user_blocks b where
        (b.blocker_id=(select auth.uid()) and b.blocked_id=p_target_user_id)
        or (b.blocker_id=p_target_user_id and b.blocked_id=(select auth.uid()))
    ) then false
    else private.visibility_allows(
      p_target_user_id,(select auth.uid()),
      coalesce((select ps.group_add_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone'),
      'group_add'
    )
  end;
$$;
revoke all on function private.can_add_user_to_group(uuid) from public, anon, authenticated;

create or replace function private.capture_status_audience()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_scope text;
begin
  select coalesce(ps.status_visibility,'contacts') into v_scope
  from public.privacy_settings ps where ps.user_id=new.user_id;
  v_scope := coalesce(v_scope,'contacts');
  if v_scope='custom' then v_scope := 'contacts_except'; end if;
  if v_scope='everyone' then v_scope := 'contacts'; end if;
  if v_scope='contacts' then
    select coalesce(array_agg(distinct c.other_id),array[]::uuid[]) into new.audience_user_ids
    from (
      select case when c.user_one=new.user_id then c.user_two else c.user_one end as other_id
      from public.conversations c
      where c.is_group=false and (c.user_one=new.user_id or c.user_two=new.user_id)
    ) c;
  elsif v_scope='contacts_except' then
    select coalesce(array_agg(distinct c.other_id),array[]::uuid[]) into new.audience_user_ids
    from (
      select case when c.user_one=new.user_id then c.user_two else c.user_one end as other_id
      from public.conversations c
      where c.is_group=false and (c.user_one=new.user_id or c.user_two=new.user_id)
    ) c
    where not exists (
      select 1 from public.status_privacy_exclusions e
      where e.owner_id=new.user_id and e.excluded_user_id=c.other_id
    );
  elsif v_scope='only_share' then
    select coalesce(array_agg(i.included_user_id),array[]::uuid[]) into new.audience_user_ids
    from public.status_privacy_inclusions i where i.owner_id=new.user_id;
  else
    new.audience_user_ids := array[]::uuid[];
  end if;
  return new;
end;
$$;
drop trigger if exists statuses_capture_audience on public.statuses;
create trigger statuses_capture_audience before insert on public.statuses
for each row execute function private.capture_status_audience();

create or replace function private.can_view_status_item(p_status_id uuid,p_viewer_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.statuses s
    where s.id=p_status_id
      and s.expires_at>now()
      and (
        s.user_id=p_viewer_id
        or (
          not exists (
            select 1 from public.user_blocks b where
              (b.blocker_id=s.user_id and b.blocked_id=p_viewer_id)
              or (b.blocker_id=p_viewer_id and b.blocked_id=s.user_id)
          )
          and case
            when s.audience_user_ids is not null then p_viewer_id=any(s.audience_user_ids)
            else private.can_view_status(s.user_id,p_viewer_id)
          end
        )
      )
  );
$$;
revoke all on function private.can_view_status_item(uuid,uuid) from public, anon, authenticated;

drop policy if exists status_read_active_unblocked on public.statuses;
create policy status_read_active_unblocked on public.statuses
for select to authenticated
using (expires_at>now() and private.can_view_status_item(id,(select auth.uid())));

drop policy if exists status_views_insert_visible on public.status_views;
create policy status_views_insert_visible on public.status_views
for insert to authenticated
with check (
  viewer_id=(select auth.uid())
  and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=(select auth.uid())),true)
  and private.can_view_status_item(status_id,(select auth.uid()))
  and exists(select 1 from public.statuses s where s.id=status_id and s.user_id<>(select auth.uid()))
);

drop policy if exists status_views_owner_read on public.status_views;
create policy status_views_owner_read on public.status_views
for select to authenticated
using (
  exists (
    select 1 from public.statuses s
    where s.id=status_id and s.user_id=(select auth.uid())
      and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=(select auth.uid())),true)
  )
  and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=status_views.viewer_id),true)
);

drop policy if exists message_reads_insert_self on public.message_reads;
create policy message_reads_insert_self on public.message_reads
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.id=message_reads.message_id and m.sender_id<>(select auth.uid())
      and (
        (not c.is_group and (
          (c.user_one=(select auth.uid()) and c.user_two=m.sender_id)
          or (c.user_two=(select auth.uid()) and c.user_one=m.sender_id)
        ) and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=(select auth.uid())),true))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id=c.id and cm.user_id=(select auth.uid())
        ))
      )
  )
);

drop policy if exists message_reads_select_participants on public.message_reads;
create policy message_reads_select_participants on public.message_reads
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1 from public.messages m
    join public.conversations c on c.id=m.conversation_id
    where m.id=message_reads.message_id and m.sender_id=(select auth.uid())
      and (
        c.is_group
        or (
          coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=(select auth.uid())),true)
          and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=message_reads.user_id),true)
        )
      )
  )
);

drop policy if exists mersal_status_read_active_visible on storage.objects;
create policy mersal_status_read_active_visible on storage.objects
for select to authenticated
using (
  bucket_id='mersal-attachments'
  and (storage.foldername(name))[1]='statuses'
  and exists (
    select 1 from public.statuses s
    where s.media_path=objects.name and s.expires_at>now()
      and private.can_view_status_item(s.id,(select auth.uid()))
  )
);
