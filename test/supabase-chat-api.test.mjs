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


test("chat API encodes search terms and message pagination parameters", async () => {
  const urls = [];
  const api = createSupabaseChatApi({
    getAccessToken: async () => "token",
    fetchImpl: async url => {
      urls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ success: true, users: [], messages: [] }) };
    }
  });
  await api.searchUsers("فهد & أحمد");
  await api.listMessages("group/one", { limit: 25, before: "2026-11-07T10:00:00+00:00" });
  assert.match(urls[0], /q=%D9%81%D9%87%D8%AF+%26+%D8%A3%D8%AD%D9%85%D8%AF/);
  assert.match(urls[1], /^\/api\/supabase\/chat\/conversations\/group%2Fone\/messages\?/);
  assert.match(urls[1], /limit=25/);
  assert.match(urls[1], /before=2026-11-07T10%3A00%3A00%2B00%3A00/);
});

test("chat API rejects empty media before making a network request", async () => {
  let called = false;
  const api = createSupabaseChatApi({
    getAccessToken: async () => "token",
    fetchImpl: async () => { called = true; }
  });
  await assert.rejects(api.uploadMedia("conversation-1", {
    name: "empty.txt", type: "text/plain", size: 0,
    arrayBuffer: async () => new ArrayBuffer(0)
  }), { code: "UPLOAD_INPUT_INVALID", status: 400 });
  assert.equal(called, false);
});

test("chat API reports server failures when response body is not JSON", async () => {
  const api = createSupabaseChatApi({
    getAccessToken: async () => "token",
    fetchImpl: async () => ({
      ok: false, status: 502,
      json: async () => { throw new Error("not JSON"); }
    })
  });
  await assert.rejects(api.listConversations(), {
    code: "CHAT_REQUEST_FAILED", status: 502, message: "Chat request failed."
  });
});

test("chat API rejects media upload without a session", async () => {
  let called = false;
  const api = createSupabaseChatApi({
    getAccessToken: async () => null,
    fetchImpl: async () => { called = true; }
  });
  await assert.rejects(api.uploadMedia("conversation-1", {
    name: "photo.png", type: "image/png", size: 1,
    arrayBuffer: async () => new ArrayBuffer(1)
  }), { code: "AUTH_REQUIRED", status: 401 });
  assert.equal(called, false);
});
