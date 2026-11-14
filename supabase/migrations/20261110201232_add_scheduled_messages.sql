
create extension if not exists pg_cron;

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status = any (array['pending','sent','cancelled','failed'])),
  sent_message_id uuid references public.messages(id) on delete set null,
  sent_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages (scheduled_at)
  where status = 'pending';
create index if not exists scheduled_messages_sender_status_time_idx
  on public.scheduled_messages (sender_id, status, scheduled_at);

alter table public.scheduled_messages enable row level security;

drop policy if exists scheduled_messages_select_own on public.scheduled_messages;
create policy scheduled_messages_select_own
  on public.scheduled_messages for select to authenticated
  using (sender_id = (select auth.uid()));

drop policy if exists scheduled_messages_insert_own on public.scheduled_messages;
create policy scheduled_messages_insert_own
  on public.scheduled_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and scheduled_at > now()
    and exists (
      select 1
      from public.conversations c
      where c.id = scheduled_messages.conversation_id
        and (
          (
            not c.is_group
            and ((select auth.uid()) = c.user_one or (select auth.uid()) = c.user_two)
            and not exists (
              select 1 from public.user_blocks ub
              where (
                (ub.blocker_id = (select auth.uid()) and ub.blocked_id =
                  case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
                or
                (ub.blocked_id = (select auth.uid()) and ub.blocker_id =
                  case when c.user_one = (select auth.uid()) then c.user_two else c.user_one end)
              )
            )
          )
          or
          (
            c.is_group
            and exists (
              select 1 from public.conversation_members cm
              where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
            )
          )
        )
    )
  );

drop policy if exists scheduled_messages_cancel_own on public.scheduled_messages;
create policy scheduled_messages_cancel_own
  on public.scheduled_messages for update to authenticated
  using (sender_id = (select auth.uid()) and status = 'pending')
  with check (sender_id = (select auth.uid()) and status = 'cancelled');

create or replace function private.process_due_scheduled_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  item record;
  inserted_message_id uuid;
  can_send boolean;
  processed_count integer := 0;
begin
  for item in
    select sm.id, sm.conversation_id, sm.sender_id, sm.body
    from public.scheduled_messages sm
    where sm.status = 'pending'
      and sm.scheduled_at <= now()
    order by sm.scheduled_at, sm.created_at
    for update skip locked
    limit 100
  loop
    select exists (
      select 1
      from public.conversations c
      where c.id = item.conversation_id
        and (
          (
            c.is_group
            and exists (
              select 1 from public.conversation_members cm
              where cm.conversation_id = c.id and cm.user_id = item.sender_id
            )
          )
          or
          (
            not c.is_group
            and (c.user_one = item.sender_id or c.user_two = item.sender_id)
            and not exists (
              select 1 from public.user_blocks ub
              where (
                (ub.blocker_id = item.sender_id and ub.blocked_id =
                  case when c.user_one = item.sender_id then c.user_two else c.user_one end)
                or
                (ub.blocked_id = item.sender_id and ub.blocker_id =
                  case when c.user_one = item.sender_id then c.user_two else c.user_one end)
              )
            )
          )
        )
    ) into can_send;

    if can_send then
      insert into public.messages (conversation_id, sender_id, body)
      values (item.conversation_id, item.sender_id, item.body)
      returning id into inserted_message_id;

      update public.scheduled_messages
      set status = 'sent',
          sent_message_id = inserted_message_id,
          sent_at = now(),
          failure_reason = null
      where id = item.id;
    else
      update public.scheduled_messages
      set status = 'failed',
          failure_reason = 'لم تعد تملك صلاحية الإرسال في هذه المحادثة.'
      where id = item.id;
    end if;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$function$;

revoke all on function private.process_due_scheduled_messages() from public, anon, authenticated;
grant execute on function private.process_due_scheduled_messages() to postgres;

do $schedule$
begin
  if exists (select 1 from cron.job where jobname = 'mersal-process-scheduled-messages') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'mersal-process-scheduled-messages';
  end if;
  perform cron.schedule(
    'mersal-process-scheduled-messages',
    '* * * * *',
    'select private.process_due_scheduled_messages();'
  );
end;
$schedule$;
