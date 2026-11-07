"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseProfileHandlers } = require("../supabase-profile-handlers");

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

function setup(profile) {
  const calls = [];
  const builder = {
    select(value) { calls.push(["select", value]); return this; },
    eq(column, value) { calls.push(["eq", column, value]); return this; },
    update(value) { calls.push(["update", value]); return this; },
    maybeSingle: async () => ({ data: profile, error: null }),
    single: async () => ({ data: { ...profile, display_name: "اسم جديد", bio: "نبذة جديدة" }, error: null })
  };
  const client = { from(table) { calls.push(["from", table]); return builder; } };
  const verified = [];
  const tokens = [];
  const handlers = createSupabaseProfileHandlers({
    verifier: { async verifyRequest(req) { verified.push(req.headers.authorization); return { uid: "user-1" }; } },
    createUserClient(token) { tokens.push(token); return client; },
    async assertNameAllowed(name) { calls.push(["moderate", name]); }
  });
  return { handlers, calls, verified, tokens };
}

test("Supabase profile GET verifies bearer identity and uses a user-scoped client", async () => {
  const profile = { id: "user-1", username: "fahed", display_name: "فهد", bio: "نبذة", avatar_url: null };
  const { handlers, calls, verified, tokens } = setup(profile);
  const res = response();
  await handlers.getProfile({ headers: { authorization: "Bearer supa-token" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profile.playerName, "فهد");
  assert.deepEqual(verified, ["Bearer supa-token"]);
  assert.deepEqual(tokens, ["supa-token"]);
  assert.deepEqual(calls.slice(0, 3), [
    ["from", "profiles"],
    ["select", "id,username,display_name,bio,avatar_url,created_at,updated_at"],
    ["eq", "id", "user-1"]
  ]);
});

test("Supabase profile update validates and moderates before updating own row", async () => {
  const profile = { id: "user-1", username: "fahed", display_name: "فهد", bio: "", avatar_url: null };
  const { handlers, calls, tokens } = setup(profile);
  const res = response();
  await handlers.updateProfile({
    headers: { authorization: "Bearer supa-token" },
    body: { playerName: "اسم جديد", bio: "نبذة جديدة" }
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profile.playerName, "اسم جديد");
  assert.deepEqual(tokens, ["supa-token"]);
  assert.ok(calls.some(call => call[0] === "moderate" && call[1] === "اسم جديد"));
  assert.ok(calls.some(call => call[0] === "update" && call[1].display_name === "اسم جديد" && call[1].bio === "نبذة جديدة"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === "user-1"));
});

test("Supabase profile update rejects invalid display names before database writes", async () => {
  const profile = { id: "user-1", username: "fahed", display_name: "فهد", bio: "", avatar_url: null };
  const { handlers, calls } = setup(profile);
  const res = response();
  await handlers.updateProfile({
    headers: { authorization: "Bearer supa-token" },
    body: { playerName: "x", bio: "" }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "PROFILE_NAME_INVALID");
  assert.equal(calls.some(call => call[0] === "update"), false);
});

test("Supabase profile routes return 401 when the access token is invalid", async () => {
  const handlers = createSupabaseProfileHandlers({
    verifier: { async verifyRequest() { const error = new Error("invalid"); error.code = "AUTH_INVALID"; throw error; } },
    createUserClient() { throw new Error("must not create a client"); }
  });
  const res = response();
  await handlers.getProfile({ headers: { authorization: "Bearer expired" } }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "AUTH_INVALID");
});
