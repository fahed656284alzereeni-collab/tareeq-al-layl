alter table public.privacy_settings
  alter column last_seen_visibility set default 'everyone',
  alter column online_visibility set default 'everyone';

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
    ), 'everyone') = 'everyone' then true
    when coalesce((
      select case when p_kind = 'last_seen' then ps.last_seen_visibility else ps.online_visibility end
      from public.privacy_settings ps where ps.user_id = p_target_user_id
    ), 'everyone') = 'contacts'
      then private.is_mersal_contact(p_target_user_id, (select auth.uid()))
    else false
  end;
$$;
