"use strict";

const MESSAGE_COLUMNS = "id,conversation_id,sender_id,body,attachment,reply_to,created_at,read_at,edited_at,deleted_at,deleted_for_everyone";

function requiredId(value, label) {
  const id = String(value || "").trim();
  if (!id) {
    const error = new TypeError(label + " is required.");
    error.code = "INVALID_ID";
    throw error;
  }
  return id;
}

function validateAttachmentMetadata(attachment, conversationId, userId) {
  if (attachment == null) return null;
  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
    const error = new TypeError("Attachment metadata must be an object.");
    error.code = "ATTACHMENT_INVALID";
    throw error;
  }
  const type = String(attachment.type || "").trim();
  const name = String(attachment.name || "").trim();
  const storagePath = String(attachment.storagePath || "").trim();
  const size = Number(attachment.size);
  const prefix = "conversations/" + conversationId + "/" + userId + "/";
  if (!type || type.length > 150 || !name || name.length > 255 ||
      !Number.isSafeInteger(size) || size < 1 || size > 52428800 ||
      !storagePath.startsWith(prefix) || storagePath.includes("..")) {
    const error = new Error("Attachment metadata or storage path is invalid.");
    error.code = "ATTACHMENT_INVALID";
    throw error;
  }
  return attachment;
}

function createSupabaseChatRepository(client, userId) {
  if (!client || typeof client.from !== "function" || typeof client.rpc !== "function") {
    throw new TypeError("A request-scoped Supabase client is required.");
  }
  const uid = requiredId(userId, "Verified user id");

  async function rpc(name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function listConversations() {
    const { data: memberships, error: membershipError } = await client
      .from("conversation_members")
      .select("conversation_id,role,joined_at,cleared_at")
      .eq("user_id", uid)
      .is("left_at", null)
      .eq("is_hidden", false);
    if (membershipError) throw membershipError;
    const rows = memberships || [];
    if (!rows.length) return [];
    const ids = rows.map(row => row.conversation_id);
    const { data: conversations, error } = await client
      .from("conversations")
      .select("id,type,title,description,announcement,group_permissions,created_by,last_message_at,updated_at,user_one,user_two")
      .in("id", ids)
      .order("last_message_at", { ascending: false });
    if (error) throw error;
    const byId = new Map(rows.map(row => [row.conversation_id, row]));
    return Promise.all((conversations || []).map(async conversation => {
      const details = await getConversationDetails(conversation.id);
      const recent = await getConversationMessages(conversation.id, { limit: 20, latest: true });
      const lastMessage = recent[0] || null;
      const members = details?.members || [];
      const other = members.find(member => member.user_id !== uid);
      const group = conversation.type === "group";
      return {
        ...conversation,
        membership: byId.get(conversation.id),
        otherUid: group ? null : (other?.user_id || null),
        displayName: group
          ? (conversation.title || "مجموعة")
          : (other?.profile?.display_name || other?.profile?.username || "مستخدم"),
        groupName: group ? (conversation.title || "مجموعة") : null,
        memberNames: group ? members.map(member => member.profile?.display_name || member.profile?.username || "مستخدم") : [],
        lastMessage: lastMessage
          ? (lastMessage.deleted_for_everyone ? "تم حذف الرسالة" : (lastMessage.body || (lastMessage.attachment ? "أرسل مرفقًا" : "")))
          : "",
        lastMessageAt: lastMessage?.created_at || conversation.last_message_at || null,
        lastMessageSenderUid: lastMessage?.sender_id || null,
      };
    }));
  }

  async function getConversationDetails(conversationId) {
    const id = requiredId(conversationId, "Conversation id");
    const { data: conversation, error } = await client
      .from("conversations")
      .select("id,type,title,description,announcement,group_permissions,created_by,last_message_at,updated_at,user_one,user_two")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) return null;
    const { data: memberships, error: membershipError } = await client
      .from("conversation_members")
      .select("user_id,role,joined_at")
      .eq("conversation_id", id)
      .is("left_at", null);
    if (membershipError) throw membershipError;
    const memberIds = (memberships || []).map(row => row.user_id);
    let profiles = [];
    if (memberIds.length) {
      const result = await client.from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", memberIds);
      if (result.error) throw result.error;
      profiles = result.data || [];
    }
    const profileById = new Map(profiles.map(profile => [profile.id, profile]));
    return {
      ...conversation,
      members: (memberships || []).map(member => ({
        ...member,
        profile: profileById.get(member.user_id) || null
      }))
    };
  }

  async function getConversationMessages(conversationId, options = {}) {
    const id = requiredId(conversationId, "Conversation id");
    const limit = Math.max(1, Math.min(Number(options.limit) || 100, 200));
    let query = client.from("messages")
      .select(MESSAGE_COLUMNS + ",message_receipts(user_id,delivered_at,read_at),message_user_visibility(user_id)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: !options.latest })
      .limit(limit);
    if (options.before) query = query.lt("created_at", options.before);
    const { data, error } = await query;
    if (error) throw error;
    return (data || [])
      .filter(message => !(message.message_user_visibility || []).some(row => row.user_id === uid))
      .map(message => ({
        ...message,
        receipts: message.message_receipts || [],
        message_receipts: undefined,
        message_user_visibility: undefined
      }));
  }

  async function sendMessage(input = {}) {
    const conversationId = requiredId(input.conversationId, "Conversation id");
    const body = String(input.body ?? "");
    const attachment = validateAttachmentMetadata(input.attachment ?? null, conversationId, uid);
    if (body.trim().length === 0 && !attachment) {
      const error = new Error("A message must contain text or an attachment.");
      error.code = "MESSAGE_EMPTY";
      throw error;
    }
    if (body.length > 4000) {
      const error = new Error("Message is too long.");
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
    const row = {
      conversation_id: conversationId,
      sender_id: uid,
      body,
      attachment,
      reply_to: input.replyTo || null
    };
    const { data, error } = await client.from("messages")
      .insert(row)
      .select(MESSAGE_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  async function createDirectConversation(otherUserId) {
    return rpc("create_direct_conversation", { p_other_user: requiredId(otherUserId, "Other user id") });
  }

  async function createGroupConversation(title, memberIds = []) {
    const cleanTitle = String(title || "").trim();
    if (cleanTitle.length < 1 || cleanTitle.length > 50) {
      const error = new Error("Group title must contain between 1 and 50 characters.");
      error.code = "GROUP_TITLE_INVALID";
      throw error;
    }
    return rpc("create_group_conversation", {
      p_title: cleanTitle,
      p_member_ids: [...new Set((memberIds || []).map(id => requiredId(id, "Group member id")))]
    });
  }

  async function getFriendData() {
    const [friends, requests, blocks] = await Promise.all([
      client.from("friendships").select("user_id,friend_id,created_at").eq("user_id", uid),
      client.from("friend_requests").select("id,sender_id,recipient_id,status,created_at").or("sender_id.eq." + uid + ",recipient_id.eq." + uid),
      client.from("user_blocks").select("blocked_id,created_at").eq("blocker_id", uid)
    ]);
    for (const result of [friends, requests, blocks]) if (result.error) throw result.error;
    const friendIds = (friends.data || []).map(row => row.friend_id);
    const requestIds = (requests.data || []).flatMap(row => [row.sender_id, row.recipient_id]).filter(id => id !== uid);
    const blockedIds = (blocks.data || []).map(row => row.blocked_id);
    const ids = [...new Set([...friendIds, ...requestIds, ...blockedIds])];
    let profiles = [];
    if (ids.length) {
      const result = await client.from("profiles").select("id,username,display_name,avatar_url").in("id", ids);
      if (result.error) throw result.error;
      profiles = result.data || [];
    }
    return { friends: friends.data || [], requests: requests.data || [], blocks: blocks.data || [], profiles };
  }

  async function searchUsers(query, limit = 20) {
    const term = String(query || "").trim();
    if (term.length < 2) return [];
    const { data, error } = await client.from("profiles")
      .select("id,username,display_name,avatar_url")
      .ilike("display_name", "%" + term.replace(/[%_]/g, "") + "%")
      .neq("id", uid)
      .limit(Math.max(1, Math.min(Number(limit) || 20, 50)));
    if (error) throw error;
    return data || [];
  }

  async function blockUser(otherUserId) {
    const other = requiredId(otherUserId, "Other user id");
    if (other === uid) throw new TypeError("A user cannot block themselves.");
    const { error } = await client.from("user_blocks").insert({ blocker_id: uid, blocked_id: other });
    if (error && error.code !== "23505") throw error;
    return true;
  }

  async function unblockUser(otherUserId) {
    const other = requiredId(otherUserId, "Other user id");
    const { error } = await client.from("user_blocks").delete().eq("blocker_id", uid).eq("blocked_id", other);
    if (error) throw error;
    return true;
  }

  async function reportUser(input = {}) {
    const reason = String(input.reason || "").trim();
    if (!reason) throw new TypeError("A report reason is required.");
    const { data, error } = await client.from("user_reports").insert({
      reporter_id: uid,
      reported_user_id: input.reportedUserId || null,
      conversation_id: input.conversationId || null,
      message_id: input.messageId || null,
      reason,
      details: String(input.details || "").slice(0, 2000)
    }).select("id,status,created_at").single();
    if (error) throw error;
    return data;
  }

  async function scheduleMessage(input = {}) {
    const conversationId = requiredId(input.conversationId, "Conversation id");
    const scheduledFor = new Date(input.scheduledFor);
    if (!Number.isFinite(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      const error = new Error("Scheduled time must be in the future.");
      error.code = "SCHEDULE_TIME_INVALID";
      throw error;
    }
    const body = String(input.body ?? "");
    const attachment = validateAttachmentMetadata(input.attachment ?? null, conversationId, uid);
    if (!body.trim() && !attachment) throw new TypeError("A scheduled message needs text or an attachment.");
    if (body.length > 4000) {
      const error = new Error("Scheduled message is too long.");
      error.code = "MESSAGE_TOO_LONG";
      throw error;
    }
    const { data, error } = await client.from("scheduled_messages").insert({
      conversation_id: conversationId,
      sender_id: uid,
      body,
      attachment,
      scheduled_for: scheduledFor.toISOString()
    }).select("id,conversation_id,sender_id,body,attachment,scheduled_for,status,created_at").single();
    if (error) throw error;
    return data;
  }

  async function listScheduledMessages() {
    const { data, error } = await client.from("scheduled_messages")
      .select("id,conversation_id,body,attachment,scheduled_for,status,created_at")
      .eq("sender_id", uid)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  return Object.freeze({
    listConversations,
    getConversationDetails,
    getConversationMessages,
    sendMessage,
    createDirectConversation,
    createGroupConversation,
    addGroupMembers: (conversationId, memberIds) => rpc("add_group_members", {
      p_conversation_id: requiredId(conversationId, "Conversation id"),
      p_member_ids: [...new Set((memberIds || []).map(id => requiredId(id, "Group member id")))]
    }),
    removeGroupMember: (conversationId, memberId) => rpc("remove_group_member", {
      p_conversation_id: requiredId(conversationId, "Conversation id"),
      p_target_user: requiredId(memberId, "Group member id")
    }),
    leaveGroup: conversationId => rpc("leave_group", { p_conversation_id: requiredId(conversationId, "Conversation id") }),
    renameGroup: (conversationId, title) => rpc("rename_group", {
      p_conversation_id: requiredId(conversationId, "Conversation id"), p_title: String(title || "").trim()
    }),
    updateGroupDetails: (conversationId, description, announcement) => rpc("update_group_details", {
      p_conversation_id: requiredId(conversationId, "Conversation id"),
      p_description: String(description || ""), p_announcement: String(announcement || "")
    }),
    updateGroupPermissions: (conversationId, editInfo, addMembers) => rpc("update_group_permissions", {
      p_conversation_id: requiredId(conversationId, "Conversation id"), p_edit_info: editInfo, p_add_members: addMembers
    }),
    setGroupModerator: (conversationId, memberId, isModerator) => rpc("set_group_moderator", {
      p_conversation_id: requiredId(conversationId, "Conversation id"),
      p_target_user: requiredId(memberId, "Group member id"), p_make_moderator: Boolean(isModerator)
    }),
    deleteGroup: conversationId => rpc("delete_group", { p_conversation_id: requiredId(conversationId, "Conversation id") }),
    editMessage: (messageId, body) => rpc("edit_message", { p_message_id: requiredId(messageId, "Message id"), p_body: String(body || "") }),
    deleteMessageForMe: async messageId => {
      const { error } = await client.from("message_user_visibility").insert({
        message_id: requiredId(messageId, "Message id"), user_id: uid
      });
      if (error && error.code !== "23505") throw error;
      return true;
    },
    deleteMessageForEveryone: messageId => rpc("delete_message_for_everyone", { p_message_id: requiredId(messageId, "Message id") }),
    markMessageDelivered: messageId => rpc("mark_message_delivered", { p_message_id: requiredId(messageId, "Message id") }),
    markMessageRead: messageId => rpc("mark_message_read", { p_message_id: requiredId(messageId, "Message id") }),
    saveVideoDuration: (messageId, durationSeconds) => rpc("save_video_duration", {
      p_message_id: requiredId(messageId, "Message id"), p_duration_seconds: Number(durationSeconds)
    }),
    hideConversationForMe: conversationId => rpc("hide_conversation_for_me", { p_conversation_id: requiredId(conversationId, "Conversation id") }),
    clearConversationForMe: conversationId => rpc("clear_conversation_for_me", { p_conversation_id: requiredId(conversationId, "Conversation id") }),
    clearConversationForEveryone: conversationId => rpc("clear_conversation_for_everyone", { p_conversation_id: requiredId(conversationId, "Conversation id") }),
    deleteDirectConversation: conversationId => rpc("delete_direct_conversation", { p_conversation_id: requiredId(conversationId, "Conversation id") }),
    sendFriendRequest: otherUserId => rpc("send_friend_request", { p_recipient_id: requiredId(otherUserId, "Other user id") }),
    cancelFriendRequest: requestId => rpc("cancel_friend_request", { p_request_id: requiredId(requestId, "Friend request id") }),
    acceptFriendRequest: requestId => rpc("accept_friend_request", { p_request_id: requiredId(requestId, "Friend request id") }),
    declineFriendRequest: requestId => rpc("decline_friend_request", { p_request_id: requiredId(requestId, "Friend request id") }),
    removeFriendship: otherUserId => rpc("remove_friendship", { p_friend_id: requiredId(otherUserId, "Friend id") }),
    getFriendData,
    searchUsers,
    blockUser,
    unblockUser,
    reportUser,
    scheduleMessage,
    listScheduledMessages,
    cancelScheduledMessage: scheduledId => rpc("cancel_scheduled_message", { p_scheduled_id: requiredId(scheduledId, "Scheduled message id") })
  });
}

module.exports = { createSupabaseChatRepository, MESSAGE_COLUMNS, requiredId, validateAttachmentMetadata };
