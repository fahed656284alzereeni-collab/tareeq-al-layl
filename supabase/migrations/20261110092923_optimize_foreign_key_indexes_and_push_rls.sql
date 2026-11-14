
create index if not exists conversation_hidden_for_user_id_idx
  on public.conversation_hidden_for (user_id);
create index if not exists message_hidden_for_user_id_idx
  on public.message_hidden_for (user_id);
create index if not exists messages_sender_id_idx
  on public.messages (sender_id);
create index if not exists notifications_conversation_id_idx
  on public.notifications (conversation_id);
create index if not exists notifications_message_id_idx
  on public.notifications (message_id);
create index if not exists notifications_sender_id_idx
  on public.notifications (sender_id);
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id);

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
