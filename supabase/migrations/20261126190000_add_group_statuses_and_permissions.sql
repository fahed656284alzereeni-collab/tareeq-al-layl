alter table public.group_settings
  add column if not exists status_enabled boolean not null default true,
  add column if not exists status_posting_by text not null default 'everyone';

alter table public.group_settings
  drop constraint if exists group_settings_status_posting_by_check;

alter table public.group_settings
  add constraint group_settings_status_posting_by_check
  check (status_posting_by in ('everyone', 'admins'));

alter table public.statuses
  add column if not exists group_conversation_id uuid
  references public.conversations(id) on delete cascade;

create index if not exists statuses_group_active_created_idx
  on public.statuses (group_conversation_id, created_at desc)
  where group_conversation_id is not null;

create or replace function private.can_view_status_item(p_status_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_viewer_id = (select auth.uid()) and exists (
    select 1
    from public.statuses s
    where s.id = p_status_id
      and s.expires_at > now()
      and (
        s.user_id = p_viewer_id
        or (
          s.group_conversation_id is not null
          and exists (
            select 1
            from public.conversations c
            where c.id = s.group_conversation_id
              and c.is_group = true
              and (
                c.user_one = p_viewer_id
                or exists (
                  select 1
                  from public.conversation_members cm
                  where cm.conversation_id = c.id
                    and cm.user_id = p_viewer_id
                )
              )
          )
        )
        or (
          s.group_conversation_id is null
          and not exists (
            select 1
            from public.user_blocks b
            where (b.blocker_id = s.user_id and b.blocked_id = p_viewer_id)
               or (b.blocker_id = p_viewer_id and b.blocked_id = s.user_id)
          )
          and case
            when s.audience_user_ids is not null then p_viewer_id = any(s.audience_user_ids)
            else private.can_view_status(s.user_id, p_viewer_id)
          end
        )
      )
  );
$function$;

drop policy if exists status_insert_own on public.statuses;
create policy status_insert_own
on public.statuses
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and created_at <= (now() + interval '1 minute')
  and expires_at > now()
  and expires_at <= (now() + interval '24 hours 5 minutes')
  and (
    group_conversation_id is null
    or exists (
      select 1
      from public.conversations c
      where c.id = group_conversation_id
        and c.is_group = true
        and (
          private.is_group_owner(c.id)
          or private.is_group_member(c.id)
        )
        and coalesce(
          (select gs.status_enabled from public.group_settings gs where gs.conversation_id = c.id),
          true
        )
        and (
          coalesce(
            (select gs.status_posting_by from public.group_settings gs where gs.conversation_id = c.id),
            'everyone'
          ) = 'everyone'
          or private.is_group_admin(c.id)
        )
    )
  )
);
