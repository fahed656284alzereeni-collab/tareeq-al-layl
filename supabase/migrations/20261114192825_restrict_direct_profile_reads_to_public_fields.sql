revoke select on table public.profiles from public, anon, authenticated;
revoke select (id, display_name, avatar_url, about, created_at, last_seen_at, updated_at)
  on table public.profiles from public, anon, authenticated;
grant select (id, display_name) on table public.profiles to authenticated;
