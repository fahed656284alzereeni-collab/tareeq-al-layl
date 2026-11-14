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

create or replace function private.can_schedule_message(p_conversation_id uuid, p_sender_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    p_sender_id = (select auth.uid())
    and p_sender_id is not null
    and exists (
      select 1
      from public.conversations c
      where c.id = p_conversation_id
        and (
          (
            c.is_group = true
            and (
              c.user_one = p_sender_id
              or exists (
                select 1
                from public.conversation_members cm
                where cm.conversation_id = c.id
                  and cm.user_id = p_sender_id
              )
            )
            and (
              coalesce(
                (
                  select gs.send_messages_by
                  from public.group_settings gs
                  where gs.conversation_id = c.id
                ),
                'everyone'
              ) <> 'admins'
              or c.user_one = p_sender_id
              or exists (
                select 1
                from public.conversation_members cm
                where cm.conversation_id = c.id
                  and cm.user_id = p_sender_id
                  and cm.role = 'admin'
              )
            )
          )
          or
          (
            c.is_group = false
            and (c.user_one = p_sender_id or c.user_two = p_sender_id)
            and not exists (
              select 1
              from public.user_blocks ub
              where
                (ub.blocker_id = p_sender_id and ub.blocked_id =
                  case when c.user_one = p_sender_id then c.user_two else c.user_one end)
                or
                (ub.blocked_id = p_sender_id and ub.blocker_id =
                  case when c.user_one = p_sender_id then c.user_two else c.user_one end)
            )
          )
        )
    );
$function$;

comment on table public.group_join_requests is
  'RLS intentionally has no direct client policies; access is mediated by authenticated RPCs that verify group-admin permissions.';
