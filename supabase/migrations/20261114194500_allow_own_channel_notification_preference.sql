-- No notification preference control is exposed in the current channels UI.
-- Keep channel follower rows immutable except for membership add/remove.
drop policy if exists channel_followers_update_own_notifications on public.channel_followers;
drop policy if exists channel_followers_update_self on public.channel_followers;
revoke update on public.channel_followers from authenticated;
