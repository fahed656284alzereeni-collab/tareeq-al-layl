-- Keep the profile join-date RPC unavailable to anonymous callers.
revoke execute on function public.get_profile_join_date(uuid) from anon;

-- Cover foreign-key lookups used by deletes, joins, and ownership checks.
create index if not exists call_logs_initiated_by_idx on public.call_logs (initiated_by);
create index if not exists channel_posts_author_id_idx on public.channel_posts (author_id);
create index if not exists community_groups_added_by_idx on public.community_groups (added_by);
create index if not exists community_groups_conversation_id_idx on public.community_groups (conversation_id);
create index if not exists community_posts_author_id_idx on public.community_posts (author_id);
create index if not exists group_invites_created_by_idx on public.group_invites (created_by);
create index if not exists group_settings_updated_by_idx on public.group_settings (updated_by);
create index if not exists message_pins_message_id_idx on public.message_pins (message_id);
create index if not exists message_pins_pinned_by_idx on public.message_pins (pinned_by);
create index if not exists message_reactions_user_id_idx on public.message_reactions (user_id);
create index if not exists starred_messages_message_id_idx on public.starred_messages (message_id);
create index if not exists status_reactions_user_id_idx on public.status_reactions (user_id);
create index if not exists status_replies_sender_id_idx on public.status_replies (sender_id);
create index if not exists support_request_messages_author_id_idx on public.support_request_messages (author_id);
