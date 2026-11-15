REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, display_name, avatar_url, about, created_at, last_seen_at, updated_at)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, display_name) ON TABLE public.profiles TO authenticated;
