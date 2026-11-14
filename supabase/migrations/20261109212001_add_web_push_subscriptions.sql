
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
on public.push_subscriptions for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
select vault.create_secret('X7VA652BzrVfCnjX5mizmCD2jgHvcr4vRKozEmWSfQ4', 'mersal_webpush_private_key', 'Private VAPID key for Mersal V2 web push');
create or replace function public.get_mersal_push_private_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'mersal_webpush_private_key'
  order by created_at desc
  limit 1
$$;
revoke all on function public.get_mersal_push_private_key() from public, anon, authenticated;
grant execute on function public.get_mersal_push_private_key() to service_role;
