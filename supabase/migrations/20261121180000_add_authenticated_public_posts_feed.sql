create table if not exists public.public_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  media_path text,
  media_type text check (media_type is null or media_type in ('image','video')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint public_posts_body_length check (char_length(body) <= 5000),
  constraint public_posts_content_required check (char_length(btrim(body)) > 0 or media_path is not null),
  constraint public_posts_media_pair check ((media_path is null and media_type is null) or (media_path is not null and media_type is not null))
);
create index if not exists public_posts_created_idx on public.public_posts(created_at desc);
create index if not exists public_posts_author_created_idx on public.public_posts(author_id, created_at desc);
create table if not exists public.public_post_likes (
  post_id uuid not null references public.public_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists public_post_likes_user_idx on public.public_post_likes(user_id, post_id);
create table if not exists public.public_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.public_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists public_post_comments_post_created_idx on public.public_post_comments(post_id, created_at asc);
create table if not exists public.public_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.public_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'other' check (reason in ('spam','abuse','harassment','inappropriate','other')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);
alter table public.public_posts enable row level security;
alter table public.public_post_likes enable row level security;
alter table public.public_post_comments enable row level security;
alter table public.public_post_reports enable row level security;
create policy public_posts_select_authenticated on public.public_posts for select to authenticated using (true);
create policy public_posts_insert_own on public.public_posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy public_posts_update_own on public.public_posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy public_posts_delete_own on public.public_posts for delete to authenticated using (author_id = (select auth.uid()));
create policy public_post_likes_select_authenticated on public.public_post_likes for select to authenticated using (true);
create policy public_post_likes_insert_own on public.public_post_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy public_post_likes_delete_own on public.public_post_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy public_post_comments_select_authenticated on public.public_post_comments for select to authenticated using (true);
create policy public_post_comments_insert_own on public.public_post_comments for insert to authenticated with check (author_id = (select auth.uid()));
create policy public_post_comments_update_own on public.public_post_comments for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy public_post_comments_delete_own on public.public_post_comments for delete to authenticated using (author_id = (select auth.uid()));
create policy public_post_reports_insert_own on public.public_post_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy public_post_reports_select_own on public.public_post_reports for select to authenticated using (reporter_id = (select auth.uid()));
grant select, insert, update, delete on public.public_posts to authenticated;
grant select, insert, delete on public.public_post_likes to authenticated;
grant select, insert, update, delete on public.public_post_comments to authenticated;
grant select, insert on public.public_post_reports to authenticated;
create policy public_post_media_read_authenticated on storage.objects for select to authenticated using (
  bucket_id = 'mersal-attachments' and (storage.foldername(name))[1] = 'public-posts'
  and ((storage.foldername(name))[2] = (select auth.uid())::text or exists (select 1 from public.public_posts p where p.media_path = objects.name))
);
create policy public_post_media_upload_own on storage.objects for insert to authenticated with check (
  bucket_id = 'mersal-attachments' and (storage.foldername(name))[1] = 'public-posts'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
create policy public_post_media_delete_own on storage.objects for delete to authenticated using (
  bucket_id = 'mersal-attachments' and (storage.foldername(name))[1] = 'public-posts'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_posts') then alter publication supabase_realtime add table public.public_posts; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_post_likes') then alter publication supabase_realtime add table public.public_post_likes; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_post_comments') then alter publication supabase_realtime add table public.public_post_comments; end if;
end $$;
