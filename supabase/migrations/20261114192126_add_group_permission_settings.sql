create table if not exists public.group_settings (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  send_messages_by text not null default 'everyone'
    check (send_messages_by in ('everyone','admins')),
  add_members_by text not null default 'admins'
    check (add_members_by in ('everyone','admins')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.group_settings enable row level security;
revoke all on table public.group_settings from anon, public;
grant select, insert, update on table public.group_settings to authenticated;

drop policy if exists group_settings_select_members on public.group_settings;
create policy group_settings_select_members
on public.group_settings for select to authenticated
using (
  private.is_group_admin(conversation_id)
  or private.is_group_member(conversation_id)
);

drop policy if exists group_settings_insert_admins on public.group_settings;
create policy group_settings_insert_admins
on public.group_settings for insert to authenticated
with check (
  private.is_group_admin(conversation_id)
  and updated_by = (select auth.uid())
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.is_group)
);

drop policy if exists group_settings_update_admins on public.group_settings;
create policy group_settings_update_admins
on public.group_settings for update to authenticated
using (private.is_group_admin(conversation_id))
with check (
  private.is_group_admin(conversation_id)
  and updated_by = (select auth.uid())
  and exists (select 1 from public.conversations c where c.id = conversation_id and c.is_group)
);

-- A group-wide "admins only" setting is enforced by RLS, not just by hiding the send button.
drop policy if exists messages_insert_as_self_in_conversation on public.messages;
create policy messages_insert_as_self_in_conversation
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        (
          not c.is_group
          and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
          and not exists (
            select 1 from public.user_blocks ub
            where
              (ub.blocker_id = (select auth.uid()) and ub.blocked_id =
                case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
              or
              (ub.blocked_id = (select auth.uid()) and ub.blocker_id =
                case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
          )
        )
        or (
          c.is_group
          and (private.is_group_owner(c.id) or private.is_group_member(c.id))
          and (
            coalesce(
              (select gs.send_messages_by from public.group_settings gs where gs.conversation_id = c.id),
              'everyone'
            ) <> 'admins'
            or private.is_group_admin(c.id)
          )
        )
      )
    )
);

-- Group creators/admins retain the current default. If the setting is changed to everyone,
-- any member may add a person, subject to the target user's privacy and block rules.
drop policy if exists conversation_members_insert_admin on public.conversation_members;
create policy conversation_members_insert_admin
on public.conversation_members for insert to authenticated
with check (
  (
    private.is_group_admin(conversation_id)
    or (
      private.is_group_member(conversation_id)
      and coalesce(
        (select gs.add_members_by from public.group_settings gs where gs.conversation_id = conversation_members.conversation_id),
        'admins'
      ) = 'everyone'
    )
  )
  and private.can_add_user_to_group(user_id)
);
