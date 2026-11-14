alter table public.group_settings
  add column if not exists require_admin_approval boolean not null default false;

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique (conversation_id, user_id)
);
create index if not exists group_join_requests_pending_idx
  on public.group_join_requests (conversation_id, requested_at desc)
  where status = 'pending';
alter table public.group_join_requests enable row level security;
revoke all on table public.group_join_requests from anon, authenticated;

create or replace function public.get_group_invite_preview(p_token uuid)
returns table (conversation_id uuid, group_name text, group_description text, group_photo_path text, member_count bigint, require_admin_approval boolean, is_member boolean, request_status text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
  v_group_name text;
  v_group_description text;
  v_group_photo_path text;
  v_member_count bigint;
  v_require_admin_approval boolean;
  v_is_member boolean;
  v_request_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select c.id,c.group_name,c.group_description,c.group_photo_path
    into v_conversation_id,v_group_name,v_group_description,v_group_photo_path
  from public.group_invites gi join public.conversations c on c.id=gi.conversation_id
  where gi.token=p_token and c.is_group=true;
  if v_conversation_id is null then raise exception 'Invalid or expired group invite'; end if;
  select exists (
    select 1 from public.conversations c where c.id=v_conversation_id and c.user_one=v_user_id
    union all
    select 1 from public.conversation_members cm where cm.conversation_id=v_conversation_id and cm.user_id=v_user_id
  ) into v_is_member;
  select coalesce(gs.require_admin_approval,false) into v_require_admin_approval
  from (select 1) seed left join public.group_settings gs on gs.conversation_id=v_conversation_id;
  select count(*) + case when exists (
    select 1 from public.conversations c where c.id=v_conversation_id and not exists (
      select 1 from public.conversation_members cm where cm.conversation_id=v_conversation_id and cm.user_id=c.user_one
    )
  ) then 1 else 0 end into v_member_count
  from public.conversation_members cm where cm.conversation_id=v_conversation_id;
  select gjr.status into v_request_status from public.group_join_requests gjr
  where gjr.conversation_id=v_conversation_id and gjr.user_id=v_user_id;
  return query select v_conversation_id,v_group_name,v_group_description,v_group_photo_path,v_member_count,v_require_admin_approval,v_is_member,v_request_status;
end;
$function$;

create or replace function public.request_group_join_by_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
  v_require_admin_approval boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select c.id into v_conversation_id from public.group_invites gi
  join public.conversations c on c.id=gi.conversation_id
  where gi.token=p_token and c.is_group=true for update of c;
  if v_conversation_id is null then raise exception 'Invalid or expired group invite'; end if;
  if exists (
    select 1 from public.conversations c where c.id=v_conversation_id and c.user_one=v_user_id
    union all
    select 1 from public.conversation_members cm where cm.conversation_id=v_conversation_id and cm.user_id=v_user_id
  ) then return jsonb_build_object('status','joined','conversation_id',v_conversation_id); end if;
  select coalesce(gs.require_admin_approval,false) into v_require_admin_approval
  from (select 1) seed left join public.group_settings gs on gs.conversation_id=v_conversation_id;
  if v_require_admin_approval then
    insert into public.group_join_requests(conversation_id,user_id,status,requested_at,reviewed_at,reviewed_by)
    values(v_conversation_id,v_user_id,'pending',now(),null,null)
    on conflict(conversation_id,user_id) do update set status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null
    where public.group_join_requests.status='rejected';
    return jsonb_build_object('status','pending','conversation_id',v_conversation_id);
  end if;
  insert into public.conversation_members(conversation_id,user_id,role)
  values(v_conversation_id,v_user_id,'member') on conflict(conversation_id,user_id) do nothing;
  update public.group_join_requests set status='cancelled',reviewed_at=now(),reviewed_by=null
  where conversation_id=v_conversation_id and user_id=v_user_id and status='pending';
  return jsonb_build_object('status','joined','conversation_id',v_conversation_id);
end;
$function$;

create or replace function public.join_group_by_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
  v_require_admin_approval boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select c.id into v_conversation_id from public.group_invites gi
  join public.conversations c on c.id=gi.conversation_id
  where gi.token=p_token and c.is_group=true;
  if v_conversation_id is null then raise exception 'Invalid or expired group invite'; end if;
  if exists (
    select 1 from public.conversations c where c.id=v_conversation_id and c.user_one=v_user_id
    union all
    select 1 from public.conversation_members cm where cm.conversation_id=v_conversation_id and cm.user_id=v_user_id
  ) then return v_conversation_id; end if;
  select coalesce(gs.require_admin_approval,false) into v_require_admin_approval
  from (select 1) seed left join public.group_settings gs on gs.conversation_id=v_conversation_id;
  if v_require_admin_approval then raise exception 'Admin approval required'; end if;
  insert into public.conversation_members(conversation_id,user_id,role)
  values(v_conversation_id,v_user_id,'member') on conflict(conversation_id,user_id) do nothing;
  return v_conversation_id;
end;
$function$;

create or replace function public.list_group_join_requests(p_conversation_id uuid)
returns table(request_id uuid,user_id uuid,display_name text,avatar_url text,requested_at timestamptz)
language plpgsql security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.is_group_admin(p_conversation_id) then raise exception 'Group admin required'; end if;
  return query select gjr.id,gjr.user_id,coalesce(nullif(btrim(p.display_name),''),'مستخدم مرسال'),p.avatar_url,gjr.requested_at
  from public.group_join_requests gjr left join public.profiles p on p.id=gjr.user_id
  where gjr.conversation_id=p_conversation_id and gjr.status='pending'
  order by gjr.requested_at asc;
end;
$function$;

create or replace function public.review_group_join_request(p_request_id uuid,p_approve boolean)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_conversation_id uuid;
  v_request_user_id uuid;
  v_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select gjr.conversation_id,gjr.user_id,gjr.status into v_conversation_id,v_request_user_id,v_status
  from public.group_join_requests gjr where gjr.id=p_request_id for update;
  if v_conversation_id is null then raise exception 'Join request not found'; end if;
  if not private.is_group_admin(v_conversation_id) then raise exception 'Group admin required'; end if;
  if v_status<>'pending' then raise exception 'Join request is no longer pending'; end if;
  if p_approve then
    insert into public.conversation_members(conversation_id,user_id,role)
    values(v_conversation_id,v_request_user_id,'member') on conflict(conversation_id,user_id) do nothing;
  end if;
  update public.group_join_requests set status=case when p_approve then 'approved' else 'rejected' end,
    reviewed_at=now(),reviewed_by=v_user_id where id=p_request_id;
  return v_conversation_id;
end;
$function$;

revoke all on function public.get_group_invite_preview(uuid) from public,anon;
revoke all on function public.request_group_join_by_invite(uuid) from public,anon;
revoke all on function public.list_group_join_requests(uuid) from public,anon;
revoke all on function public.review_group_join_request(uuid,boolean) from public,anon;
grant execute on function public.get_group_invite_preview(uuid) to authenticated;
grant execute on function public.request_group_join_by_invite(uuid) to authenticated;
grant execute on function public.list_group_join_requests(uuid) to authenticated;
grant execute on function public.review_group_join_request(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
