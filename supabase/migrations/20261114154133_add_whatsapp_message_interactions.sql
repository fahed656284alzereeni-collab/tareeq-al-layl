-- Additive WhatsApp-style message controls. Does not alter auth, profiles, conversations, or existing messages.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_message_idx on public.message_reactions(message_id);

create table if not exists public.starred_messages (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index if not exists starred_messages_user_created_idx on public.starred_messages(user_id, created_at desc);

create table if not exists public.message_pins (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, message_id)
);
create index if not exists message_pins_conversation_created_idx on public.message_pins(conversation_id, created_at desc);

alter table public.message_reactions enable row level security;
alter table public.starred_messages enable row level security;
alter table public.message_pins enable row level security;

drop policy if exists message_reactions_select_participants on public.message_reactions;
create policy message_reactions_select_participants on public.message_reactions
for select to authenticated using (
  exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_reactions.message_id
      and (
        (not c.is_group and auth.uid() in (c.user_one, c.user_two))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists message_reactions_insert_self_participant on public.message_reactions;
create policy message_reactions_insert_self_participant on public.message_reactions
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_reactions.message_id
      and m.is_deleted = false
      and (
        (not c.is_group and auth.uid() in (c.user_one, c.user_two))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists message_reactions_delete_own on public.message_reactions;
create policy message_reactions_delete_own on public.message_reactions
for delete to authenticated using (user_id = auth.uid());

drop policy if exists starred_messages_select_own on public.starred_messages;
create policy starred_messages_select_own on public.starred_messages
for select to authenticated using (user_id = auth.uid());

drop policy if exists starred_messages_insert_own_participant on public.starred_messages;
create policy starred_messages_insert_own_participant on public.starred_messages
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = starred_messages.message_id
      and (
        (not c.is_group and auth.uid() in (c.user_one, c.user_two))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists starred_messages_delete_own on public.starred_messages;
create policy starred_messages_delete_own on public.starred_messages
for delete to authenticated using (user_id = auth.uid());

drop policy if exists message_pins_select_participants on public.message_pins;
create policy message_pins_select_participants on public.message_pins
for select to authenticated using (
  exists (
    select 1 from public.conversations c
    where c.id = message_pins.conversation_id
      and (
        (not c.is_group and auth.uid() in (c.user_one, c.user_two))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists message_pins_insert_participants on public.message_pins;
create policy message_pins_insert_participants on public.message_pins
for insert to authenticated with check (
  pinned_by = auth.uid()
  and exists (
    select 1 from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = message_pins.message_id
      and c.id = message_pins.conversation_id
      and m.is_deleted = false
      and (
        (not c.is_group and auth.uid() in (c.user_one, c.user_two))
        or (c.is_group and exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = auth.uid()
        ))
      )
  )
);

drop policy if exists message_pins_delete_own_or_group_admin on public.message_pins;
create policy message_pins_delete_own_or_group_admin on public.message_pins
for delete to authenticated using (
  pinned_by = auth.uid()
  or exists (
    select 1 from public.conversations c
    where c.id = message_pins.conversation_id
      and c.is_group
      and (private.is_group_owner(c.id) or private.is_group_admin(c.id))
  )
);

grant select, insert, delete on public.message_reactions to authenticated;
grant select, insert, delete on public.starred_messages to authenticated;
grant select, insert, delete on public.message_pins to authenticated;
