-- Add covering indexes for foreign keys and remove duplicate permissive SELECT policy.
begin;

create index if not exists conversations_created_by_idx
  on public.conversations(created_by);

create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests(recipient_id,status,created_at desc);

create index if not exists friendships_friend_id_idx
  on public.friendships(friend_id);

create index if not exists message_receipts_user_id_idx
  on public.message_receipts(user_id);

create index if not exists message_user_visibility_user_id_idx
  on public.message_user_visibility(user_id);

create index if not exists messages_reply_to_idx
  on public.messages(reply_to);

create index if not exists scheduled_messages_conversation_due_idx
  on public.scheduled_messages(conversation_id,scheduled_for);

create index if not exists scheduled_messages_sender_status_idx
  on public.scheduled_messages(sender_id,status,scheduled_for);

create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks(blocked_id);

create index if not exists user_reports_conversation_id_idx
  on public.user_reports(conversation_id);

create index if not exists user_reports_message_id_idx
  on public.user_reports(message_id);

create index if not exists user_reports_reported_user_id_idx
  on public.user_reports(reported_user_id);

create index if not exists user_reports_reporter_id_idx
  on public.user_reports(reporter_id);

drop policy if exists "Users can manage own message visibility" on public.message_user_visibility;

create policy "Users can insert own message visibility"
on public.message_user_visibility for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id=message_id and private.is_conversation_member(m.conversation_id)
  )
);

create policy "Users can delete own message visibility"
on public.message_user_visibility for delete to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.messages m
    where m.id=message_id and private.is_conversation_member(m.conversation_id)
  )
);

commit;
