"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseAuthVerifier, extractBearerToken } = require("../supabase-auth-verifier");

test("extracts bearer token case-insensitively", () => {
  assert.equal(extractBearerToken({ headers: { authorization: "bearer abc.def" } }), "abc.def");
  assert.equal(extractBearerToken({ headers: {} }), null);
});

test("rejects missing token before contacting Supabase", async () => {
  const verifier = createSupabaseAuthVerifier({
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" },
    createClient: () => { throw new Error("must not create client"); }
  });
  await assert.rejects(verifier.verifyAccessToken(""), { code: "AUTH_REQUIRED" });
});

test("verifies access token with Supabase Auth and returns normalized identity", async () => {
  let receivedToken = "";
  const verifier = createSupabaseAuthVerifier({
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" },
    createClient: (url, key, config) => {
      assert.equal(url, "https://example.supabase.co");
      assert.equal(key, "public");
      assert.equal(config.auth.persistSession, false);
      return { auth: { getUser: async token => {
        receivedToken = token;
        return { data: { user: { id: "user-uuid", email: "TEST@EXAMPLE.COM", email_confirmed_at: "2026-01-01" } }, error: null };
      } } };
    }
  });
  const identity = await verifier.verifyRequest({ headers: { authorization: "Bearer signed-token" } });
  assert.equal(receivedToken, "signed-token");
  assert.equal(identity.uid, "user-uuid");
  assert.equal(identity.email, "test@example.com");
  assert.equal(identity.emailVerified, true);
});

test("rejects tokens Supabase Auth does not recognize", async () => {
  const verifier = createSupabaseAuthVerifier({
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "public" },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: { message: "bad token" } }) } })
  });
  await assert.rejects(verifier.verifyAccessToken("bad-token"), { code: "AUTH_INVALID" });
});
