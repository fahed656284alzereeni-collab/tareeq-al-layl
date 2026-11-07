/**
 * Browser-facing adapter for the opt-in Supabase chat HTTP API.
 * It is intentionally not imported by chat.html until the Firebase cutover
 * and the complete VoiceOver/mobile regression pass are approved.
 */
export function createSupabaseChatApi(options = {}) {
  const getAccessToken = options.getAccessToken;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = String(options.baseUrl || "/api/supabase/chat").replace(/\/$/, "");
  if (typeof getAccessToken !== "function") throw new TypeError("getAccessToken is required.");
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required.");

  async function request(path, init = {}) {
    const token = await getAccessToken();
    if (!token) {
      const error = new Error("Authentication is required.");
      error.code = "AUTH_REQUIRED";
      error.status = 401;
      throw error;
    }
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", "Bearer " + token);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetchImpl(baseUrl + path, {
      ...init, headers, cache: "no-store"
    });
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok || payload.success === false) {
      const error = new Error(payload.message || "Chat request failed.");
      error.code = payload.code || "CHAT_REQUEST_FAILED";
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  const json = value => JSON.stringify(value);
  const id = value => encodeURIComponent(String(value));
  return Object.freeze({
    listConversations: () => request("/conversations"),
    getConversation: conversationId => request("/conversations/" + id(conversationId)),
    listMessages: (conversationId, options = {}) => {
      const query = new URLSearchParams();
      if (options.limit) query.set("limit", String(options.limit));
      if (options.before) query.set("before", String(options.before));
      return request("/conversations/" + id(conversationId) + "/messages" + (query.size ? "?" + query : ""));
    },
    createDirectConversation: otherUserId => request("/conversations/direct", { method: "POST", body: json({ otherUserId }) }),
    createGroupConversation: (title, memberIds) => request("/conversations/group", { method: "POST", body: json({ title, memberIds }) }),
    sendMessage: message => request("/messages", { method: "POST", body: json(message) }),
    markMessageRead: messageId => request("/messages/" + id(messageId) + "/read", { method: "POST" }),
    markMessageDelivered: messageId => request("/messages/" + id(messageId) + "/delivered", { method: "POST" }),
    editMessage: (messageId, body) => request("/messages/" + id(messageId) + "/edit", { method: "POST", body: json({ body }) }),
    deleteMessageForMe: messageId => request("/messages/" + id(messageId) + "/delete-for-me", { method: "POST" }),
    deleteMessageForEveryone: messageId => request("/messages/" + id(messageId) + "/delete-for-everyone", { method: "POST" }),
    hideConversation: conversationId => request("/conversations/" + id(conversationId) + "/hide", { method: "POST" }),
    clearConversationForMe: conversationId => request("/conversations/" + id(conversationId) + "/clear-for-me", { method: "POST" }),
    clearConversationForEveryone: conversationId => request("/conversations/" + id(conversationId) + "/clear-for-everyone", { method: "POST" }),
    deleteDirectConversation: conversationId => request("/conversations/" + id(conversationId), { method: "DELETE" }),
    sendFriendRequest: otherUserId => request("/friend-requests", { method: "POST", body: json({ otherUserId }) }),
    acceptFriendRequest: requestId => request("/friend-requests/" + id(requestId) + "/accept", { method: "POST" }),
    declineFriendRequest: requestId => request("/friend-requests/" + id(requestId) + "/decline", { method: "POST" }),
    cancelFriendRequest: requestId => request("/friend-requests/" + id(requestId) + "/cancel", { method: "POST" }),
    getFriendData: () => request("/friends"),
    removeFriendship: userId => request("/friends/" + id(userId), { method: "DELETE" }),
    searchUsers: query => request("/users/search?q=" + encodeURIComponent(String(query || ""))),
    blockUser: otherUserId => request("/blocks", { method: "POST", body: json({ otherUserId }) }),
    unblockUser: userId => request("/blocks/" + id(userId), { method: "DELETE" }),
    reportUser: report => request("/reports", { method: "POST", body: json(report) }),
    scheduleMessage: message => request("/scheduled-messages", { method: "POST", body: json(message) }),
    listNotifications: () => request("/notifications"),
    markNotificationRead: notificationId => request("/notifications/" + id(notificationId) + "/read", { method: "POST" }),
    listScheduledMessages: () => request("/scheduled-messages"),
    cancelScheduledMessage: scheduledId => request("/scheduled-messages/" + id(scheduledId), { method: "DELETE" }),
    addGroupMembers: (conversationId, memberIds) => request("/conversations/" + id(conversationId) + "/members", { method: "POST", body: json({ memberIds }) }),
    removeGroupMember: (conversationId, userId) => request("/conversations/" + id(conversationId) + "/members/" + id(userId), { method: "DELETE" }),
    leaveGroup: conversationId => request("/conversations/" + id(conversationId) + "/leave", { method: "POST" }),
    renameGroup: (conversationId, title) => request("/conversations/" + id(conversationId), { method: "PATCH", body: json({ title }) }),
    updateGroupDetails: (conversationId, description, announcement) => request("/conversations/" + id(conversationId) + "/details", { method: "PATCH", body: json({ description, announcement }) }),
    updateGroupPermissions: (conversationId, editInfo, addMembers) => request("/conversations/" + id(conversationId) + "/permissions", { method: "PATCH", body: json({ editInfo, addMembers }) }),
    setGroupModerator: (conversationId, userId, isModerator) => request("/conversations/" + id(conversationId) + "/members/" + id(userId) + "/moderator", { method: "PATCH", body: json({ isModerator }) }),
    deleteGroup: conversationId => request("/groups/" + id(conversationId), { method: "DELETE" }),
    saveVideoDuration: (messageId, durationSeconds) => request("/messages/" + id(messageId) + "/video-duration", { method: "PATCH", body: json({ durationSeconds }) })
  });
}
