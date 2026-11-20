do $block$
declare
  item record;
begin
  for item in
    select c.table_name, string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position) as columns_sql
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = any (array[
        'broadcast_lists','call_logs','channel_posts','channels','channel_followers',
        'communities','community_members','community_posts','conversation_members',
        'conversation_preferences','group_poll_votes','group_settings','message_deliveries',
        'message_hidden_for','message_pins','message_reactions','message_reads',
        'message_view_once_views','messages','notifications','privacy_exclusions',
        'privacy_settings','profiles','push_subscriptions','scheduled_messages',
        'starred_messages','status_privacy_exclusions','status_privacy_inclusions',
        'status_reactions','status_views','statuses','support_requests'
      ])
    group by c.table_name
  loop
    execute format('revoke update on table public.%I from public, anon, authenticated', item.table_name);
    execute format('revoke update (%s) on table public.%I from public, anon, authenticated', item.columns_sql, item.table_name);
  end loop;
end
$block$;

grant update (status, ended_at) on table public.call_logs to authenticated;
grant update (body, edited_at, is_deleted) on table public.channel_posts to authenticated;
grant update (name, description, updated_at) on table public.channels to authenticated;
grant update (notifications_enabled) on table public.channel_followers to authenticated;
grant update (name, description, updated_at) on table public.communities to authenticated;
grant update (body, edited_at, is_deleted) on table public.community_posts to authenticated;
grant update (conversation_id, user_id, muted, updated_at) on table public.conversation_preferences to authenticated;
grant update (poll_id, user_id, option_index) on table public.group_poll_votes to authenticated;
grant update (conversation_id, add_members_by, require_admin_approval, send_messages_by, updated_at, updated_by)
  on table public.group_settings to authenticated;
grant update (body, edited_at, is_deleted) on table public.messages to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant update (about_visibility, group_add_visibility, hide_notification_preview, last_seen_visibility,
              online_visibility, profile_photo_visibility, read_receipts_enabled, status_visibility, updated_at, user_id)
  on table public.privacy_settings to authenticated;
grant update (display_name, about, avatar_url, last_seen_at, updated_at) on table public.profiles to authenticated;
grant update (user_id, endpoint, subscription) on table public.push_subscriptions to authenticated;
grant update (status) on table public.scheduled_messages to authenticated;
grant update (emoji) on table public.status_reactions to authenticated;
grant update (status, updated_at) on table public.support_requests to authenticated;
