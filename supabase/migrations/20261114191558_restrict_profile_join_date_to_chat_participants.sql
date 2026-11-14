-- Restrict profile join-date disclosure to the account owner and direct-chat participants.
-- The RPC is used by the conversation-info screen; authenticated users must not be
-- able to enumerate creation dates for arbitrary profile IDs.
create or replace function public.get_profile_join_date(p_user_id uuid)
returns timestamp with time zone
language sql
stable
security definer
set search_path to ''
as $function$
  select p.created_at
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id = p_user_id
    and (
      p.id = (select auth.uid())
      or exists (
        select 1
        from public.conversations c
        where c.is_group = false
          and (
            (c.user_one = (select auth.uid()) and c.user_two = p_user_id)
            or
            (c.user_two = (select auth.uid()) and c.user_one = p_user_id)
          )
      )
    );
$function$;

-- Direct table access remains intentionally unavailable. Group-join requests are
-- read and changed only through SECURITY DEFINER RPCs that verify group-admin rights.
comment on table public.group_join_requests is
  'RLS intentionally has no direct client policies; access is mediated by authenticated RPCs that verify group-admin permissions.';
