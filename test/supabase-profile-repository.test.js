"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseProfileRepository } = require("../supabase-profile-repository");

function makeClient(result) {
  const calls = [];
  const builder = {
    select(value) { calls.push(["select", value]); return this; },
    eq(column, value) { calls.push(["eq", column, value]); return this; },
    update(value) { calls.push(["update", value]); return this; },
    maybeSingle: async () => result,
    single: async () => result
  };
  return { client: { from(table) { calls.push(["from", table]); return builder; } }, calls };
}

test("reads only the requested user's profile through the scoped client", async () => {
  const profile = { id: "user-1", display_name: "فهد", bio: "نبذة" };
  const { client, calls } = makeClient({ data: profile, error: null });
  const repository = createSupabaseProfileRepository(client);
  assert.deepEqual(await repository.getProfile("user-1"), profile);
  assert.deepEqual(calls.slice(0, 3), [
    ["from", "profiles"],
    ["select", "id,username,display_name,bio,avatar_url,created_at,updated_at"],
    ["eq", "id", "user-1"]
  ]);
});

test("updates only display name and bio for the verified user", async () => {
  const profile = { id: "user-1", display_name: "فهد الجديد", bio: "نبذة جديدة" };
  const { client, calls } = makeClient({ data: profile, error: null });
  const repository = createSupabaseProfileRepository(client);
  assert.deepEqual(await repository.updateProfile("user-1", {
    displayName: "فهد الجديد",
    bio: "نبذة جديدة"
  }), profile);
  assert.ok(calls.some(call => call[0] === "update" && call[1].display_name === "فهد الجديد" && call[1].bio === "نبذة جديدة"));
  assert.ok(calls.some(call => call[0] === "eq" && call[1] === "id" && call[2] === "user-1"));
});

test("rejects invalid profile values before issuing a database update", async () => {
  const { client, calls } = makeClient({ data: null, error: null });
  const repository = createSupabaseProfileRepository(client);
  await assert.rejects(repository.updateProfile("user-1", { displayName: "x" }), { code: "PROFILE_NAME_INVALID" });
  await assert.rejects(repository.updateProfile("user-1", { bio: "x".repeat(201) }), { code: "PROFILE_BIO_TOO_LONG" });
  assert.equal(calls.some(call => call[0] === "update"), false);
});
