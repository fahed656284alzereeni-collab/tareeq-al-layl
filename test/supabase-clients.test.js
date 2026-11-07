"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseUserClient, createSupabaseAdminClient } = require("../supabase-clients");

test("user-scoped client uses publishable key and caller bearer token", () => {
  let received;
  const client = createSupabaseUserClient("user-access-token", {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test"
    },
    createClient: (...args) => { received = args; return { kind: "user" }; }
  });
  assert.deepEqual(client, { kind: "user" });
  assert.equal(received[0], "https://example.supabase.co");
  assert.equal(received[1], "sb_publishable_test");
  assert.equal(received[2].global.headers.Authorization, "Bearer user-access-token");
  assert.equal(received[2].auth.persistSession, false);
});

test("user-scoped client rejects a missing access token", () => {
  assert.throws(
    () => createSupabaseUserClient("", { env: {}, createClient: () => ({}) }),
    { code: "AUTH_REQUIRED" }
  );
});

test("user-scoped client never falls back to a server secret", () => {
  assert.throws(
    () => createSupabaseUserClient("token", {
      env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
      createClient: () => ({})
    }),
    { code: "SUPABASE_USER_CLIENT_NOT_CONFIGURED" }
  );
});

test("admin client uses only the server secret and disables browser persistence", () => {
  let received;
  createSupabaseAdminClient({
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test" },
    createClient: (...args) => { received = args; return {}; }
  });
  assert.equal(received[1], "sb_secret_test");
  assert.equal(received[2].auth.persistSession, false);
  assert.equal(received[2].global, undefined);
});
