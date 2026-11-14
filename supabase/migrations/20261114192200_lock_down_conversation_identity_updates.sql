revoke update on table public.conversations from public, anon, authenticated;
revoke update (id, user_one, user_two, created_at, last_message_at, is_group, group_name, group_description, group_photo_path)
  on table public.conversations from public, anon, authenticated;
grant update (group_name, group_description, group_photo_path)
  on table public.conversations to authenticated;

drop policy if exists conversations_update_participants on public.conversations;
create policy conversations_update_group_owner
  on public.conversations
  for update
  to authenticated
  using (is_group = true and user_one = (select auth.uid()))
  with check (is_group = true and user_one = (select auth.uid()));
