-- Ensure every new Supabase Auth identity receives an application profile.
-- Safe to apply repeatedly; existing profile rows are preserved.
begin;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_display_name text;
  v_avatar_url text;
begin
  v_display_name := left(
    coalesce(
      nullif(btrim(v_metadata->>'full_name'), ''),
      nullif(btrim(v_metadata->>'name'), ''),
      nullif(btrim(v_metadata->>'preferred_username'), ''),
      'مستخدم'
    ),
    30
  );

  if char_length(v_display_name) < 2 then
    v_display_name := 'مستخدم';
  end if;

  v_avatar_url := coalesce(
    nullif(btrim(v_metadata->>'avatar_url'), ''),
    nullif(btrim(v_metadata->>'picture'), '')
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, v_display_name, v_avatar_url)
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

commit;
