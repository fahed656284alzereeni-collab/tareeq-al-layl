create or replace function private.can_view_user_presence(p_target_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case
    when (select auth.uid()) is null or p_target_user_id is null then false
    when p_target_user_id=(select auth.uid()) then true
    when exists(
      select 1 from public.user_blocks b
      where (b.blocker_id=(select auth.uid()) and b.blocked_id=p_target_user_id)
         or (b.blocker_id=p_target_user_id and b.blocked_id=(select auth.uid()))
    ) then false
    -- Mutual privacy: if the viewer does not share their own last-seen
    -- information with this person, they cannot see this person's last seen or online state.
    when not private.visibility_allows(
      (select auth.uid()),
      p_target_user_id,
      coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id=(select auth.uid())),'contacts'),
      'last_seen'
    ) then false
    when p_kind='last_seen' then private.visibility_allows(
      p_target_user_id,
      (select auth.uid()),
      coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'contacts'),
      'last_seen'
    )
    when p_kind='online' then
      case coalesce((select ps.online_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'everyone')
        when 'everyone' then true
        when 'same_as_last_seen' then private.visibility_allows(
          p_target_user_id,
          (select auth.uid()),
          coalesce((select ps.last_seen_visibility from public.privacy_settings ps where ps.user_id=p_target_user_id),'contacts'),
          'last_seen'
        )
        else false
      end
    else false
  end;
$$;
revoke all on function private.can_view_user_presence(uuid,text) from public,anon,authenticated;
