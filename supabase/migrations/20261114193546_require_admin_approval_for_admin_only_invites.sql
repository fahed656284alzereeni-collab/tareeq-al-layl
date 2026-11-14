create or replace function public.get_group_invite_preview(p_token uuid)
returns table(
  conversation_id uuid,
  group_name text,
  group_description text,
  group_photo_path text,
  member_count bigint,
  require_admin_approval boolean,
  is_member boolean,
  request_status text
)
language plpgsql
security definer
set search_path to ''
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

  select
    coalesce(gs.require_admin_approval,false)
      or coalesce(gs.add_members_by,'admins')='admins'
    into v_require_admin_approval
  from (select 1) seed
  left join public.group_settings gs on gs.conversation_id=v_conversation_id;

  select count(*) + case when exists (
    select 1 from public.conversations c where c.id=v_conversation_id and not exists (
      select 1 from public.conversation_members cm where cm.conversation_id=v_conversation_id and cm.user_id=c.user_one
    )
  ) then 1 else 0 end into v_member_count
  from public.conversation_members cm where cm.conversation_id=v_conversation_id;

  select gjr.status into v_request_status from public.group_join_requests gjr
  where gjr.conversation_id=v_conversation_id and gjr.user_id=v_user_id;

  return query select v_conversation_id,v_group_name,v_group_description,v_group_photo_path,
    v_member_count,v_require_admin_approval,v_is_member,v_request_status;
end;
$function$;

create or replace function public.join_group_by_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
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

  select
    coalesce(gs.require_admin_approval,false)
      or coalesce(gs.add_members_by,'admins')='admins'
    into v_require_admin_approval
  from (select 1) seed
  left join public.group_settings gs on gs.conversation_id=v_conversation_id;

  if v_require_admin_approval then raise exception 'Admin approval required'; end if;
  insert into public.conversation_members(conversation_id,user_id,role)
  values(v_conversation_id,v_user_id,'member') on conflict(conversation_id,user_id) do nothing;
  return v_conversation_id;
end;
$function$;

create or replace function public.request_group_join_by_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
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

  select
    coalesce(gs.require_admin_approval,false)
      or coalesce(gs.add_members_by,'admins')='admins'
    into v_require_admin_approval
  from (select 1) seed
  left join public.group_settings gs on gs.conversation_id=v_conversation_id;

  if v_require_admin_approval then
    insert into public.group_join_requests(conversation_id,user_id,status,requested_at,reviewed_at,reviewed_by)
    values(v_conversation_id,v_user_id,'pending',now(),null,null)
    on conflict(conversation_id,user_id) do update
      set status='pending',requested_at=now(),reviewed_at=null,reviewed_by=null
      where public.group_join_requests.status='rejected';
    return jsonb_build_object('status','pending','conversation_id',v_conversation_id);
  end if;

  insert into public.conversation_members(conversation_id,user_id,role)
  values(v_conversation_id,v_user_id,'member') on conflict(conversation_id,user_id) do nothing;
  update public.group_join_requests
  set status='cancelled',reviewed_at=now(),reviewed_by=null
  where conversation_id=v_conversation_id and user_id=v_user_id and status='pending';
  return jsonb_build_object('status','joined','conversation_id',v_conversation_id);
end;
$function$;
