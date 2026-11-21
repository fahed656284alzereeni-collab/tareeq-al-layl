revoke all on table public.public_posts, public.public_post_likes, public.public_post_comments, public.public_post_reports from anon, public;
grant select, insert, update, delete on public.public_posts to authenticated;
grant select, insert, delete on public.public_post_likes to authenticated;
grant select, insert, update, delete on public.public_post_comments to authenticated;
grant select, insert on public.public_post_reports to authenticated;