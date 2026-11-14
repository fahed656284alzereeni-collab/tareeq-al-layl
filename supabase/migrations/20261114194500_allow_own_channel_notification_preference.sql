-- Allow channel followers to change only their own notification preference.
-- Do not grant UPDATE on other follower columns.
drop policy if exists channel_followers_update_own_notifications on public.channel_followers;
create policy channel_followers_update_own_notifications
on public.channel_followers
for update to authenticated
using (follower_id = (select auth.uid()))
with check (follower_id = (select auth.uid()));

revoke update on public.channel_followers from authenticated;
grant update (notifications_enabled) on public.channel_followers to authenticated;
