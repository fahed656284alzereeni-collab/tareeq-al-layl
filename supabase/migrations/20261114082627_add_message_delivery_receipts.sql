create table public.message_deliveries (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_deliveries_user_delivered_idx
  on public.message_deliveries (user_id, delivered_at desc);

alter table public.message_deliveries enable row level security;

grant select, insert on public.message_deliveries to authenticated;

create policy message_deliveries_insert_recipient
on public.message_deliveries
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.messages m
    where m.id = message_deliveries.message_id
      and m.sender_id <> (select auth.uid())
  )
);

create policy message_deliveries_select_sender_or_recipient
on public.message_deliveries
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.messages m
    where m.id = message_deliveries.message_id
      and m.sender_id = (select auth.uid())
  )
);

alter publication supabase_realtime add table public.message_deliveries;
