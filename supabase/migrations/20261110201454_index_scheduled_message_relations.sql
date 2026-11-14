create index if not exists scheduled_messages_conversation_id_idx
  on public.scheduled_messages (conversation_id);
create index if not exists scheduled_messages_sent_message_id_idx
  on public.scheduled_messages (sent_message_id)
  where sent_message_id is not null;
