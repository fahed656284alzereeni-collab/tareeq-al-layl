
create table if not exists public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_visibility text not null default 'contacts' check (last_seen_visibility in ('everyone','contacts','nobody')),
  online_visibility text not null default 'contacts' check (online_visibility in ('everyone','contacts','nobody')),
  read_receipts_enabled boolean not null default true,
  group_add_visibility text not null default 'everyone' check (group_add_visibility in ('everyone','contacts','nobody')),
  status_visibility text not null default 'contacts' check (status_visibility in ('everyone','contacts','custom','nobody')),
  hide_notification_preview boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.privacy_settings enable row level security;
drop policy if exists privacy_settings_select_own on public.privacy_settings;
create policy privacy_settings_select_own on public.privacy_settings for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists privacy_settings_insert_own on public.privacy_settings;
create policy privacy_settings_insert_own on public.privacy_settings for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists privacy_settings_update_own on public.privacy_settings;
create policy privacy_settings_update_own on public.privacy_settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.privacy_settings to authenticated;

create table if not exists public.status_privacy_exclusions (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  excluded_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, excluded_user_id),
  check (owner_id <> excluded_user_id)
);
alter table public.status_privacy_exclusions enable row level security;
drop policy if exists status_privacy_exclusions_select_own on public.status_privacy_exclusions;
create policy status_privacy_exclusions_select_own on public.status_privacy_exclusions for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists status_privacy_exclusions_insert_own on public.status_privacy_exclusions;
create policy status_privacy_exclusions_insert_own on public.status_privacy_exclusions for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists status_privacy_exclusions_delete_own on public.status_privacy_exclusions;
create policy status_privacy_exclusions_delete_own on public.status_privacy_exclusions for delete to authenticated using (owner_id = (select auth.uid()));
grant select, insert, delete on public.status_privacy_exclusions to authenticated;

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
alter table public.message_reads enable row level security;
drop policy if exists message_reads_select_participants on public.message_reads;
create policy message_reads_select_participants on public.message_reads for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.messages m where m.id = message_reads.message_id and m.sender_id = (select auth.uid())
  )
);
drop policy if exists message_reads_insert_self on public.message_reads;
create policy message_reads_insert_self on public.message_reads for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_reads.message_id
      and m.sender_id <> (select auth.uid())
      and ((not c.is_group and ((c.user_one = (select auth.uid()) and c.user_two = m.sender_id) or (c.user_two = (select auth.uid()) and c.user_one = m.sender_id)))
        or (c.is_group and exists (select 1 from public.conversation_members cm where cm.conversation_id=c.id and cm.user_id=(select auth.uid()))))
      and coalesce((select ps.read_receipts_enabled from public.privacy_settings ps where ps.user_id=(select auth.uid())), true)
  )
);
grant select, insert on public.message_reads to authenticated;

create or replace function private.is_mersal_contact(p_user_id uuid, p_other_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.is_group = false
      and ((c.user_one = p_user_id and c.user_two = p_other_id)
        or (c.user_two = p_user_id and c.user_one = p_other_id))
  );
$$;
create or replace function private.can_view_user_presence(p_target_user_id uuid, p_kind text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_target_user_id = (select auth.uid()) then true
    when exists (select 1 from public.user_blocks b where
      (b.blocker_id = (select auth.uid()) and b.blocked_id = p_target_user_id)
      or (b.blocker_id = p_target_user_id and b.blocked_id = (select auth.uid()))) then false
    when coalesce((
      select case when p_kind = 'last_seen' then ps.last_seen_visibility else ps.online_visibility end
      from public.privacy_settings ps where ps.user_id = p_target_user_id
    ), 'contacts') = 'everyone' then true
    when coalesce((
      select case when p_kind = 'last_seen' then ps.last_seen_visibility else ps.online_visibility end
      from public.privacy_settings ps where ps.user_id = p_target_user_id
    ), 'contacts') = 'contacts'
      then private.is_mersal_contact(p_target_user_id, (select auth.uid()))
    else false
  end;
$$;
create or replace function public.get_visible_presence()
returns table(user_id uuid, is_online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id,
    (p.last_seen_at >= now() - interval '90 seconds') and private.can_view_user_presence(p.id, 'online') as is_online,
    case when private.can_view_user_presence(p.id, 'last_seen') then p.last_seen_at else null end
  from public.profiles p
  where p.id <> (select auth.uid())
    and (private.can_view_user_presence(p.id, 'online') or private.can_view_user_presence(p.id, 'last_seen'))
    and not exists (select 1 from public.user_blocks b where
      (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
      or (b.blocker_id = p.id and b.blocked_id = (select auth.uid())));
$$;
revoke all on function public.get_visible_presence() from public, anon;
grant execute on function public.get_visible_presence() to authenticated;
revoke all on function private.is_mersal_contact(uuid,uuid) from public, anon;
revoke all on function private.can_view_user_presence(uuid,text) from public, anon;
grant execute on function private.is_mersal_contact(uuid,uuid) to authenticated;
grant execute on function private.can_view_user_presence(uuid,text) to authenticated;

create or replace function private.can_view_status(p_owner_id uuid, p_viewer_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_owner_id = p_viewer_id then true
    when exists (select 1 from public.user_blocks b where
      (b.blocker_id=p_owner_id and b.blocked_id=p_viewer_id)
      or (b.blocker_id=p_viewer_id and b.blocked_id=p_owner_id)) then false
    when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=p_owner_id),'contacts')='everyone' then true
    when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=p_owner_id),'contacts')='contacts'
      then private.is_mersal_contact(p_owner_id,p_viewer_id)
    when coalesce((select ps.status_visibility from public.privacy_settings ps where ps.user_id=p_owner_id),'contacts')='custom'
      then private.is_mersal_contact(p_owner_id,p_viewer_id)
       and not exists (select 1 from public.status_privacy_exclusions e where e.owner_id=p_owner_id and e.excluded_user_id=p_viewer_id)
    else false
  end;
$$;
revoke all on function private.can_view_status(uuid,uuid) from public, anon;
grant execute on function private.can_view_status(uuid,uuid) to authenticated;

drop policy if exists status_read_active_unblocked on public.statuses;
create policy status_read_active_unblocked on public.statuses for select to authenticated
using (expires_at > now() and private.can_view_status(user_id,(select auth.uid())));
drop policy if exists status_views_insert_visible on public.status_views;
create policy status_views_insert_visible on public.status_views for insert to authenticated
with check (
  viewer_id=(select auth.uid())
  and exists(select 1 from public.statuses s where s.id=status_views.status_id
    and s.user_id <> (select auth.uid()) and s.expires_at > now()
    and private.can_view_status(s.user_id,(select auth.uid())))
);

create or replace function private.can_add_user_to_group(p_target_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when p_target_user_id = (select auth.uid()) then true
    when coalesce((select ps.group_add_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone')='everyone' then true
    when coalesce((select ps.group_add_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone')='contacts'
      then private.is_mersal_contact(p_target_user_id,(select auth.uid()))
    else false
  end;
$$;
revoke all on function private.can_add_user_to_group(uuid) from public, anon;
grant execute on function private.can_add_user_to_group(uuid) to authenticated;
drop policy if exists conversation_members_insert_admin on public.conversation_members;
create policy conversation_members_insert_admin on public.conversation_members for insert to authenticated
with check ((select private.is_group_admin(conversation_id)) and private.can_add_user_to_group(user_id));

-- Protect last-seen timestamps from direct table reads; expose them only through the scoped RPC above.
revoke select on public.profiles from authenticated;
grant select (id, display_name, avatar_url, created_at, updated_at) on public.profiles to authenticated;

create or replace function public.create_message_notification()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  group_chat boolean;
  recipient uuid;
begin
  select c.is_group into group_chat from public.conversations c where c.id = new.conversation_id;
  if coalesce(group_chat, false) then
    insert into public.notifications (recipient_id, sender_id, conversation_id, message_id, preview)
    select cm.user_id, new.sender_id, new.conversation_id, new.id,
      case when coalesce((select ps.hide_notification_preview from public.privacy_settings ps where ps.user_id=cm.user_id),false)
        then 'رسالة جديدة' else left(new.body,160) end
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id
      and not exists (select 1 from public.conversation_preferences cp where cp.conversation_id=new.conversation_id and cp.user_id=cm.user_id and cp.muted=true)
    on conflict (recipient_id,message_id) do nothing;
  else
    select case when c.user_one=new.sender_id then c.user_two when c.user_two=new.sender_id then c.user_one else null end
      into recipient from public.conversations c where c.id=new.conversation_id;
    if recipient is not null and not exists (select 1 from public.conversation_preferences cp where cp.conversation_id=new.conversation_id and cp.user_id=recipient and cp.muted=true) then
      insert into public.notifications (recipient_id,sender_id,conversation_id,message_id,preview)
      values (recipient,new.sender_id,new.conversation_id,new.id,
        case when coalesce((select ps.hide_notification_preview from public.privacy_settings ps where ps.user_id=recipient),false)
          then 'رسالة جديدة' else left(new.body,160) end)
      on conflict (recipient_id,message_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
