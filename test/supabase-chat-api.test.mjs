import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseChatApi } from "../supabase-chat-api.mjs";

test("chat API attaches verified access token and disables caching", async () => {
  let captured;
  const api = createSupabaseChatApi({
    getAccessToken: async () => "signed-access-token",
    baseUrl: "https://example.test/api/supabase/chat/",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ success: true, conversations: [] }) };
    }
  });
  assert.deepEqual(await api.listConversations(), { success: true, conversations: [] });
  assert.equal(captured.url, "https://example.test/api/supabase/chat/conversations");
  assert.equal(captured.init.headers.get("Authorization"), "Bearer signed-access-token");
  assert.equal(captured.init.cache, "no-store");
});

test("chat API refuses to send a request without a session", async () => {
  let called = false;
  const api = createSupabaseChatApi({
    getAccessToken: async () => null,
    fetchImpl: async () => { called = true; }
  });
  await assert.rejects(api.listConversations(), { code: "AUTH_REQUIRED", status: 401 });
  assert.equal(called, false);
});

test("chat API preserves server error codes and HTTP status", async () => {
  const api = createSupabaseChatApi({
    getAccessToken: async () => "token",
    fetchImpl: async () => ({
      ok: false, status: 403,
      json: async () => ({ success: false, code: "42501", message: "Forbidden" })
    })
  });
  await assert.rejects(api.createDirectConversation("other"), { code: "42501", status: 403, message: "Forbidden" });
});

test("chat API URL-encodes identifiers and JSON-encodes message bodies", async () => {
  let captured;
  const api = createSupabaseChatApi({
    getAccessToken: async () => "token",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
  });
  await api.sendMessage({ conversationId: "group/a", body: "مرحبا" });
  assert.equal(captured.url, "/api/supabase/chat/messages");
  assert.equal(captured.init.headers.get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(captured.init.body), { conversationId: "group/a", body: "مرحبا" });
});

test("chat API uploads media with bearer auth and conversation metadata", async () => {
  let captured;
  const api = createSupabaseChatApi({
    getAccessToken: async () => "token",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ success: true, attachment: { storagePath: "path" } }) };
    }
  });
  const file = {
    name: "photo one.png", type: "image/png", size: 4,
    arrayBuffer: async () => new Uint8Array([1,2,3,4]).buffer
  };
  assert.deepEqual(await api.uploadMedia("conversation-1", file), { storagePath: "path" });
  assert.equal(captured.url, "/api/supabase/chat/upload");
  assert.equal(captured.init.headers.Authorization, "Bearer token");
  assert.equal(captured.init.headers["X-Conversation-Id"], "conversation-1");
  assert.equal(captured.init.headers["X-File-Name"], "photo%20one.png");
  assert.equal(captured.init.headers["Content-Type"], "application/octet-stream");
});
