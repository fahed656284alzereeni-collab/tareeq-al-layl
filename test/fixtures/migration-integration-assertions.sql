\set ON_ERROR_STOP on

-- The migration must backfill the pre-existing direct conversation.
do $backfill$
begin
  if (select count(*) from public.conversation_members
      where conversation_id='00000000-0000-0000-0000-000000000101') <> 2 then
    raise exception 'Legacy direct conversation membership was not backfilled';
  end if;
end;
$backfill$;

-- Exercise the public RPCs as an authenticated caller; the internal routines
-- must retain the caller's auth.uid() while running with their definer rights.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);

do $integration$
declare
  v_user1 uuid := '00000000-0000-0000-0000-000000000001';
  v_user2 uuid := '00000000-0000-0000-0000-000000000002';
  v_user3 uuid := '00000000-0000-0000-0000-000000000003';
  v_user4 uuid := '00000000-0000-0000-0000-000000000004';
  v_direct uuid;
  v_group uuid;
  v_request uuid;
  v_message uuid;
  v_video uuid;
  v_after_hide uuid;
  v_final uuid;
  v_scheduled uuid;
  v_rows integer;
begin
  v_direct := public.create_direct_conversation(v_user2);
  if v_direct <> '00000000-0000-0000-0000-000000000101'::uuid then
    raise exception 'Direct conversation RPC did not reuse the canonical pair';
  end if;

  v_group := public.create_group_conversation('CI group', array[v_user2,v_user3]);
  if (select count(*) from public.conversation_members
      where conversation_id=v_group and left_at is null) <> 3 then
    raise exception 'Group creation did not add creator and selected members';
  end if;
  if public.add_group_members(v_group,array[v_user4]) <> 1 then
    raise exception 'Group add-member RPC did not add exactly one member';
  end if;
  perform public.rename_group(v_group,'Renamed CI group');
  perform public.update_group_details(v_group,'description','announcement');
  perform public.update_group_permissions(v_group,'members','admins');
  perform public.set_group_moderator(v_group,v_user2,true);

  perform set_config('request.jwt.claim.sub',v_user2::text,false);
  perform public.remove_group_member(v_group,v_user3);
  perform set_config('request.jwt.claim.sub',v_user4::text,false);
  perform public.leave_group(v_group);
  perform set_config('request.jwt.claim.sub',v_user1::text,false);
  perform public.delete_group(v_group);
  if exists(select 1 from public.conversations where id=v_group) then
    raise exception 'Group delete RPC did not delete the group';
  end if;

  v_request := public.send_friend_request(v_user3);
  perform set_config('request.jwt.claim.sub',v_user3::text,false);
  perform public.accept_friend_request(v_request);
  if (select count(*) from public.friendships
      where (user_id=v_user1 and friend_id=v_user3)
         or (user_id=v_user3 and friend_id=v_user1)) <> 2 then
    raise exception 'Friend acceptance did not create reciprocal edges';
  end if;
  perform set_config('request.jwt.claim.sub',v_user1::text,false);
  perform public.remove_friendship(v_user3);
  if exists(select 1 from public.friendships
    where (user_id=v_user1 and friend_id=v_user3)
       or (user_id=v_user3 and friend_id=v_user1)) then
    raise exception 'Friend removal left a one-sided edge';
  end if;

  v_request := public.send_friend_request(v_user4);
  perform public.cancel_friend_request(v_request);
  if (select status from public.friend_requests where id=v_request) <> 'cancelled' then
    raise exception 'Outgoing friend request cancellation failed';
  end if;

  v_request := public.send_friend_request(v_user2);
  perform set_config('request.jwt.claim.sub',v_user2::text,false);
  perform public.decline_friend_request(v_request);

  perform set_config('request.jwt.claim.sub',v_user1::text,false);
  update public.profiles set display_name='Updated Name',bio='Profile bio'
    where id=v_user1;
  if not found then raise exception 'Own profile update was blocked'; end if;
  update public.profiles set display_name='Unauthorized Change' where id=v_user2;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Profile RLS allowed cross-user update'; end if;

  insert into public.messages(conversation_id,sender_id,body)
    values (v_direct,v_user1,'RLS and trigger test') returning id into v_message;
  if not exists(select 1 from public.message_receipts
    where message_id=v_message and user_id=v_user2) then
    raise exception 'Message insert trigger did not create recipient receipt';
  end if;
  if (select last_message_at from public.conversations where id=v_direct) is null then
    raise exception 'Message insert trigger did not update conversation activity';
  end if;

  -- Per-recipient delivery/read receipts are written only through RPCs.
  perform set_config('request.jwt.claim.sub',v_user2::text,false);
  perform public.mark_message_delivered(v_message);
  perform public.mark_message_read(v_message);
  if not exists(select 1 from public.message_receipts
    where message_id=v_message and user_id=v_user2 and delivered_at is not null and read_at is not null) then
    raise exception 'Message receipt RPCs did not mark delivered/read';
  end if;

  perform set_config('request.jwt.claim.sub',v_user1::text,false);
  perform public.edit_message(v_message,'Edited message');
  if not exists(select 1 from public.messages where id=v_message and body='Edited message' and edited_at is not null) then
    raise exception 'Message edit RPC failed';
  end if;

  perform public.hide_conversation_for_me(v_direct);
  if not exists(select 1 from public.conversation_members
    where conversation_id=v_direct and user_id=v_user1 and is_hidden) then
    raise exception 'Hide conversation for me RPC failed';
  end if;
  insert into public.messages(conversation_id,sender_id,body)
    values (v_direct,v_user1,'New message restores hidden conversation') returning id into v_after_hide;
  if exists(select 1 from public.conversation_members
    where conversation_id=v_direct and user_id=v_user1 and is_hidden) then
    raise exception 'New message did not restore hidden conversation';
  end if;

  perform public.clear_conversation_for_me(v_direct);
  if not exists(select 1 from public.message_user_visibility
    where message_id=v_message and user_id=v_user1) then
    raise exception 'Clear conversation for me did not hide prior messages';
  end if;
  insert into public.messages(conversation_id,sender_id,body)
    values (v_direct,v_user1,'Message after personal clear') returning id into v_final;
  if exists(select 1 from public.message_user_visibility
    where message_id=v_final and user_id=v_user1) then
    raise exception 'New message was incorrectly hidden after personal clear';
  end if;
  if not exists(select 1 from public.message_user_visibility
    where message_id=v_message and user_id=v_user1) then
    raise exception 'Previously cleared messages became visible again';
  end if;

  insert into public.messages(conversation_id,sender_id,body,attachment)
    values (v_direct,v_user1,'Video attachment','{"type":"video/mp4"}'::jsonb)
    returning id into v_video;
  perform public.save_video_duration(v_video,90);
  if not exists(select 1 from public.messages
    where id=v_video and attachment->>'durationSeconds'='90') then
    raise exception 'Video duration RPC failed';
  end if;
  perform public.delete_message_for_everyone(v_video);
  if exists(select 1 from public.messages where id=v_video) then
    raise exception 'Delete message for everyone RPC failed';
  end if;

  perform public.clear_conversation_for_everyone(v_direct);
  if exists(select 1 from public.messages where conversation_id=v_direct) then
    raise exception 'Clear conversation for everyone did not remove messages';
  end if;
  if (select last_message_at from public.conversations where id=v_direct) is not null then
    raise exception 'Clear conversation for everyone did not reset last message time';
  end if;

  insert into public.scheduled_messages(conversation_id,sender_id,body,scheduled_for)
    values (v_direct,v_user1,'Scheduled test',now()+interval '1 hour')
    returning id into v_scheduled;
  perform public.cancel_scheduled_message(v_scheduled);
  if (select status from public.scheduled_messages where id=v_scheduled) <> 'cancelled' then
    raise exception 'Scheduled message cancellation RPC failed';
  end if;

  insert into public.messages(conversation_id,sender_id,body)
    values (v_direct,v_user1,'Final RLS probe') returning id into v_final;

  -- Client updates are denied; callers must use the narrow RPCs.
  begin
    update public.messages set body='tampered' where id=v_final;
    raise exception 'Unexpected direct message update success';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.message_receipts set read_at=now() where message_id=v_final and user_id=v_user2;
    raise exception 'Unexpected direct receipt update success';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.scheduled_messages set status='cancelled' where id=v_scheduled;
    raise exception 'Unexpected direct scheduled-message update success';
  exception when insufficient_privilege then null;
  end;

  -- The caller cannot write membership, friendship, or friend-request rows directly.
  begin
    insert into public.conversation_members(conversation_id,user_id)
      values (v_direct,v_user3);
    raise exception 'Unexpected direct membership insert success';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.friend_requests(sender_id,recipient_id) values (v_user1,v_user3);
    raise exception 'Unexpected direct friend-request insert success';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.friendships where user_id=v_user1 and friend_id=v_user2;
    raise exception 'Unexpected direct friendship delete success';
  exception when insufficient_privilege then null;
  end;
end;
$integration$;

-- A non-member cannot see or send messages in another pair's conversation.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $negative_rls$
declare v_rows integer;
begin
  select count(*) into v_rows from public.messages
    where conversation_id='00000000-0000-0000-0000-000000000101';
  if v_rows <> 0 then raise exception 'Non-member can read messages'; end if;
  begin
    insert into public.messages(conversation_id,sender_id,body)
      values ('00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000003','unauthorized');
    raise exception 'Unexpected non-member message insert success';
  exception when insufficient_privilege then null;
  end;
end;
$negative_rls$;

-- A participant can delete a direct conversation, but the operation is scoped
-- to the authenticated member and cascades its messages/receipts.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $delete_direct$
begin
  perform public.delete_direct_conversation('00000000-0000-0000-0000-000000000101');
  if exists(select 1 from public.conversations where id='00000000-0000-0000-0000-000000000101') then
    raise exception 'Direct conversation deletion RPC failed';
  end if;
end;
$delete_direct$;

reset role;
