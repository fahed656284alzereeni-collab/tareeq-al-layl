
create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  initiated_by uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio','video')),
  status text not null default 'ringing' check (status in ('ringing','missed','declined','completed','cancelled','failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists call_logs_conversation_started_idx
  on public.call_logs (conversation_id, started_at desc);

alter table public.call_logs enable row level security;

grant select, insert, update, delete on public.call_logs to authenticated;

drop policy if exists "Conversation members can read call logs" on public.call_logs;
create policy "Conversation members can read call logs"
on public.call_logs for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = call_logs.conversation_id
      and (
        c.user_one = (select auth.uid())
        or c.user_two = (select auth.uid())
        or exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "Conversation members can create own call logs" on public.call_logs;
create policy "Conversation members can create own call logs"
on public.call_logs for insert to authenticated
with check (
  initiated_by = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = call_logs.conversation_id
      and (
        c.user_one = (select auth.uid())
        or c.user_two = (select auth.uid())
        or exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "Conversation members can update call logs" on public.call_logs;
create policy "Conversation members can update call logs"
on public.call_logs for update to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = call_logs.conversation_id
      and (
        c.user_one = (select auth.uid())
        or c.user_two = (select auth.uid())
        or exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        )
      )
  )
)
with check (
  exists (
    select 1 from public.conversations c
    where c.id = call_logs.conversation_id
      and (
        c.user_one = (select auth.uid())
        or c.user_two = (select auth.uid())
        or exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "Call initiators can delete their own call logs" on public.call_logs;
create policy "Call initiators can delete their own call logs"
on public.call_logs for delete to authenticated
using (initiated_by = (select auth.uid()));
