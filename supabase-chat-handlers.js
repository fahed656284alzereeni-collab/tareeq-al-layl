"use strict";

const { createSupabaseUserClient } = require("./supabase-clients");
const { extractBearerToken } = require("./supabase-auth-verifier");
const { createSupabaseChatRepository } = require("./supabase-chat-repository");

function createSupabaseChatHandlers(options = {}) {
  const verifier = options.verifier;
  const createUserClient = options.createUserClient || createSupabaseUserClient;
  const createRepository = options.createRepository || createSupabaseChatRepository;
  if (!verifier || typeof verifier.verifyRequest !== "function") {
    throw new TypeError("A Supabase Auth verifier is required.");
  }

  async function context(req) {
    const identity = await verifier.verifyRequest(req);
    const client = createUserClient(extractBearerToken(req));
    return { identity, repository: createRepository(client, identity.uid) };
  }

  function fail(res, error) {
    const status = error.code === "AUTH_REQUIRED" || error.code === "AUTH_INVALID" ? 401 :
      error.code === "SUPABASE_AUTH_NOT_CONFIGURED" || error.code === "SUPABASE_USER_CLIENT_NOT_CONFIGURED" ? 503 :
      error.code === "INVALID_ID" || error.code === "MESSAGE_EMPTY" ||
      error.code === "MESSAGE_TOO_LONG" || error.code === "GROUP_TITLE_INVALID" ||
      error.code === "ATTACHMENT_INVALID" || error.code === "SCHEDULE_TIME_INVALID" ||
      error.code === "22023" ? 400 :
      error.code === "42501" || error.code === "PGRST301" ? 403 :
      error.code === "P0002" ? 404 :
      error.status && Number.isInteger(error.status) ? error.status : 500;
    return res.status(status).json({
      success: false,
      code: error.code || "SUPABASE_CHAT_REQUEST_FAILED",
      message: status === 401 ? "يرجى تسجيل الدخول مجددًا." :
        status === 400 ? error.message : status === 403 ? "ليس لديك صلاحية لتنفيذ هذا الإجراء." :
        "تعذر تنفيذ طلب المحادثات حاليًا."
    });
  }

  async function run(req, res, action) {
    try {
      const { identity, repository } = await context(req);
      const result = await action(repository, identity);
      res.set("Cache-Control", "no-store");
      return res.json({ success: true, ...result });
    } catch (error) {
      return fail(res, error);
    }
  }

  return Object.freeze({
    listConversations: (req,res) => run(req,res,async repository => ({ conversations: await repository.listConversations() })),
    getConversation: (req,res) => run(req,res,async repository => {
      const conversation = await repository.getConversationDetails(req.params.conversationId);
      if (!conversation) {
        const error = new Error("Conversation not found.");
        error.code = "CONVERSATION_NOT_FOUND";
        error.status = 404;
        throw error;
      }
      return { conversation };
    }),
    listMessages: (req,res) => run(req,res,async repository => ({
      messages: await repository.getConversationMessages(req.params.conversationId, {
        limit: req.query.limit, before: req.query.before
      })
    })),
    createDirectConversation: (req,res) => run(req,res,async repository => ({
      conversationId: await repository.createDirectConversation(req.body?.otherUserId)
    })),
    createGroupConversation: (req,res) => run(req,res,async repository => ({
      conversationId: await repository.createGroupConversation(req.body?.title, req.body?.memberIds || [])
    })),
    sendMessage: (req,res) => run(req,res,async repository => ({
      message: await repository.sendMessage(req.body || {})
    })),
    markMessageRead: (req,res) => run(req,res,async repository => {
      await repository.markMessageRead(req.params.messageId); return {};
    }),
    markMessageDelivered: (req,res) => run(req,res,async repository => {
      await repository.markMessageDelivered(req.params.messageId); return {};
    }),
    hideConversation: (req,res) => run(req,res,async repository => {
      await repository.hideConversationForMe(req.params.conversationId); return {};
    }),
    clearConversationForMe: (req,res) => run(req,res,async repository => {
      await repository.clearConversationForMe(req.params.conversationId); return {};
    }),
    clearConversationForEveryone: (req,res) => run(req,res,async repository => {
      await repository.clearConversationForEveryone(req.params.conversationId); return {};
    }),
    deleteDirectConversation: (req,res) => run(req,res,async repository => {
      await repository.deleteDirectConversation(req.params.conversationId); return {};
    }),
    editMessage: (req,res) => run(req,res,async repository => {
      await repository.editMessage(req.params.messageId, req.body?.body); return {};
    }),
    deleteMessageForEveryone: (req,res) => run(req,res,async repository => {
      await repository.deleteMessageForEveryone(req.params.messageId); return {};
    }),
    sendFriendRequest: (req,res) => run(req,res,async repository => ({
      requestId: await repository.sendFriendRequest(req.body?.otherUserId)
    })),
    acceptFriendRequest: (req,res) => run(req,res,async repository => {
      await repository.acceptFriendRequest(req.params.requestId); return {};
    }),
    declineFriendRequest: (req,res) => run(req,res,async repository => {
      await repository.declineFriendRequest(req.params.requestId); return {};
    }),
    blockUser: (req,res) => run(req,res,async repository => {
      await repository.blockUser(req.body?.otherUserId); return {};
    }),
    unblockUser: (req,res) => run(req,res,async repository => {
      await repository.unblockUser(req.params.userId); return {};
    }),
    getFriendData: (req,res) => run(req,res,async repository => ({
      friendData: await repository.getFriendData()
    })),
    searchUsers: (req,res) => run(req,res,async repository => ({
      users: await repository.searchUsers(req.query.q, req.query.limit)
    })),
    reportUser: (req,res) => run(req,res,async repository => ({
      report: await repository.reportUser(req.body || {})
    })),
    scheduleMessage: (req,res) => run(req,res,async repository => ({
      scheduledMessage: await repository.scheduleMessage(req.body || {})
    })),
    listScheduledMessages: (req,res) => run(req,res,async repository => ({
      scheduledMessages: await repository.listScheduledMessages()
    })),
    cancelScheduledMessage: (req,res) => run(req,res,async repository => {
      await repository.cancelScheduledMessage(req.params.scheduledId); return {};
    }),
    addGroupMembers: (req,res) => run(req,res,async repository => ({
      addedCount: await repository.addGroupMembers(req.params.conversationId, req.body?.memberIds || [])
    })),
    removeGroupMember: (req,res) => run(req,res,async repository => {
      await repository.removeGroupMember(req.params.conversationId, req.params.userId); return {};
    }),
    leaveGroup: (req,res) => run(req,res,async repository => {
      await repository.leaveGroup(req.params.conversationId); return {};
    }),
    renameGroup: (req,res) => run(req,res,async repository => {
      await repository.renameGroup(req.params.conversationId, req.body?.title); return {};
    }),
    updateGroupDetails: (req,res) => run(req,res,async repository => {
      await repository.updateGroupDetails(req.params.conversationId, req.body?.description, req.body?.announcement); return {};
    }),
    updateGroupPermissions: (req,res) => run(req,res,async repository => {
      await repository.updateGroupPermissions(req.params.conversationId, req.body?.editInfo, req.body?.addMembers); return {};
    }),
    setGroupModerator: (req,res) => run(req,res,async repository => {
      await repository.setGroupModerator(req.params.conversationId, req.params.userId, req.body?.isModerator); return {};
    }),
    deleteGroup: (req,res) => run(req,res,async repository => {
      await repository.deleteGroup(req.params.conversationId); return {};
    }),
    deleteMessageForMe: (req,res) => run(req,res,async repository => {
      await repository.deleteMessageForMe(req.params.messageId); return {};
    }),
    saveVideoDuration: (req,res) => run(req,res,async repository => {
      await repository.saveVideoDuration(req.params.messageId, req.body?.durationSeconds); return {};
    })
  });
}

module.exports = { createSupabaseChatHandlers };
