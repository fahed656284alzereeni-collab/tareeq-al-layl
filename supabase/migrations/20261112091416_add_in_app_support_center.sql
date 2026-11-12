create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique default ('MS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('help', 'technical', 'bug', 'abuse', 'suggestion', 'other')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_user_created_idx on public.support_requests (user_id, created_at desc);
create index if not exists support_requests_status_created_idx on public.support_requests (status, created_at desc);

create table if not exists public.support_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists support_request_messages_request_created_idx on public.support_request_messages (request_id, created_at asc);

alter table public.support_requests enable row level security;
alter table public.support_request_messages enable row level security;
grant select, insert, update on public.support_requests to authenticated;
grant select, insert on public.support_request_messages to authenticated;

create policy "Support requests visible to owner and developer" on public.support_requests
for select to authenticated using (user_id = (select auth.uid()) or (select auth.uid()) = '62fa5885-8d7c-4379-95e6-a8031e4f73ab'::uuid);
create policy "Users create own support requests" on public.support_requests
for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Developer updates support request status" on public.support_requests
for update to authenticated using ((select auth.uid()) = '62fa5885-8d7c-4379-95e6-a8031e4f73ab'::uuid)
with check ((select auth.uid()) = '62fa5885-8d7c-4379-95e6-a8031e4f73ab'::uuid);

create policy "Request messages visible to owner and developer" on public.support_request_messages
for select to authenticated using (
  (select auth.uid()) = '62fa5885-8d7c-4379-95e6-a8031e4f73ab'::uuid
  or exists (select 1 from public.support_requests r where r.id = request_id and r.user_id = (select auth.uid()))
);
create policy "Request participants can reply" on public.support_request_messages
for insert to authenticated with check (
  author_id = (select auth.uid()) and exists (
    select 1 from public.support_requests r where r.id = request_id
    and (r.user_id = (select auth.uid()) or (select auth.uid()) = '62fa5885-8d7c-4379-95e6-a8031e4f73ab'::uuid)
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_requests') then
      alter publication supabase_realtime add table public.support_requests;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_request_messages') then
      alter publication supabase_realtime add table public.support_request_messages;
    end if;
  end if;
end $$;
