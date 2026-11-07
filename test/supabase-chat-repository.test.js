"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseChatRepository } = require("../supabase-chat-repository");

function makeClient({ rpcResult = { data: "result", error: null }, queryResult = { data: [], error: null }, insertResult = { data: { id: "message-1" }, error: null } } = {}) {
  const calls = [];
  const builder = {
    select(value) { calls.push(["select", value]); return this; },
    eq(...args) { calls.push(["eq", ...args]); return this; },
    is(...args) { calls.push(["is", ...args]); return this; },
    in(...args) { calls.push(["in", ...args]); return this; },
    ilike(...args) { calls.push(["ilike", ...args]); return this; },
    neq(...args) { calls.push(["neq", ...args]); return this; },
    or(...args) { calls.push(["or", ...args]); return this; },
    order(...args) { calls.push(["order", ...args]); return this; },
    limit(...args) { calls.push(["limit", ...args]); return this; },
    lt(...args) { calls.push(["lt", ...args]); return this; },
    insert(value) { calls.push(["insert", value]); return this; },
    delete() { calls.push(["delete"]); return this; },
    update(value) { calls.push(["update", value]); return this; },
    maybeSingle: async () => queryResult,
    single: async () => insertResult,
    then(resolve, reject) { return Promise.resolve(queryResult).then(resolve, reject); }
  };
  const client = {
    from(table) { calls.push(["from", table]); return builder; },
    async rpc(name, args) { calls.push(["rpc", name, args]); return rpcResult; }
  };
  return { client, calls };
}

test("conversation and group creation use authenticated database RPCs", async () => {
  const { client, calls } = makeClient({ rpcResult: { data: "conversation-1", error: null } });
  const repository = createSupabaseChatRepository(client, "user-1");
  assert.equal(await repository.createDirectConversation("user-2"), "conversation-1");
  assert.equal(await repository.createGroupConversation("Friends", ["user-2", "user-2", "user-3"]), "conversation-1");
  assert.deepEqual(calls.filter(call => call[0] === "rpc"), [
    ["rpc", "create_direct_conversation", { p_other_user: "user-2" }],
    ["rpc", "create_group_conversation", { p_title: "Friends", p_member_ids: ["user-2", "user-3"] }]
  ]);
});

test("messages are inserted with the verified sender id and attachments", async () => {
  const { client, calls } = makeClient({ insertResult: { data: { id: "message-1" }, error: null } });
  const repository = createSupabaseChatRepository(client, "verified-user");
  assert.deepEqual(await repository.sendMessage({
    conversationId: "conversation-1", body: "", attachment: { type: "image/png" }
  }), { id: "message-1" });
  const inserted = calls.find(call => call[0] === "insert")[1];
  assert.equal(inserted.sender_id, "verified-user");
  assert.deepEqual(inserted.attachment, { type: "image/png" });
});

test("message reads hide rows marked invisible to the current user", async () => {
  const rows = [
    { id: "visible", message_user_visibility: [], message_receipts: [] },
    { id: "hidden", message_user_visibility: [{ user_id: "user-1" }], message_receipts: [] }
  ];
  const { client } = makeClient({ queryResult: { data: rows, error: null } });
  const repository = createSupabaseChatRepository(client, "user-1");
  const messages = await repository.getConversationMessages("conversation-1");
  assert.deepEqual(messages.map(message => message.id), ["visible"]);
  assert.deepEqual(messages[0].receipts, []);
});

test("message lifecycle and friend actions route through narrow RPCs", async () => {
  const { client, calls } = makeClient();
  const repository = createSupabaseChatRepository(client, "user-1");
  await repository.markMessageDelivered("message-1");
  await repository.markMessageRead("message-1");
  await repository.clearConversationForMe("conversation-1");
  await repository.deleteMessageForEveryone("message-1");
  await repository.cancelFriendRequest("request-1");
  await repository.cancelScheduledMessage("scheduled-1");
  const names = calls.filter(call => call[0] === "rpc").map(call => call[1]);
  assert.deepEqual(names, [
    "mark_message_delivered", "mark_message_read", "clear_conversation_for_me",
    "delete_message_for_everyone", "cancel_friend_request", "cancel_scheduled_message"
  ]);
});

test("scheduled messages require a future time", async () => {
  const { client, calls } = makeClient();
  const repository = createSupabaseChatRepository(client, "user-1");
  await assert.rejects(
    repository.scheduleMessage({ conversationId: "conversation-1", body: "Too late", scheduledFor: "2000-01-01T00:00:00Z" }),
    { code: "SCHEDULE_TIME_INVALID" }
  );
  assert.equal(calls.some(call => call[0] === "insert"), false);
});
