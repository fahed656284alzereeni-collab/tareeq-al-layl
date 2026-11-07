"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/202611070001_expand_messaging_schema.sql"),
  "utf8"
);
const browserClient = fs.readFileSync(path.join(root, "supabase-client.js"), "utf8");

test("migration has balanced PostgreSQL dollar quoting and transaction boundaries", () => {
  const delimiters = migration.match(/\$\$/g) || [];
  assert.equal(delimiters.length % 2, 0, "every $$ delimiter must have a pair");
  assert.doesNotMatch(migration, /^(?:do|as) \$$|^\$;$/m, "single-dollar delimiters are invalid here");
  assert.match(migration, /^begin;/m);
  assert.match(migration, /^commit;/m);
});

test("private schema is created before private functions", () => {
  const schemaPosition = migration.indexOf("create schema if not exists private;");
  const functionPosition = migration.indexOf("create or replace function private.");
  assert.ok(schemaPosition >= 0, "private schema declaration is missing");
  assert.ok(functionPosition > schemaPosition, "private functions must follow schema creation");
});

test("every SECURITY DEFINER function fixes the search path", () => {
  const blocks = migration.split(/(?=create or replace function )/);
  const privileged = blocks.filter(block => /\bsecurity definer\b/i.test(block.split(/\ncreate or replace function /)[0]));
  assert.ok(privileged.length > 0, "expected privileged database routines");
  for (const block of privileged) {
    assert.match(block, /set search_path\s*=\s*''/i, "SECURITY DEFINER routine must use an empty search_path");
  }
});

test("all newly added public tables enable RLS", () => {
  const tables = [
    "conversation_members", "message_receipts", "message_user_visibility",
    "friend_requests", "friendships", "user_blocks", "user_reports",
    "scheduled_messages", "notifications"
  ];
  for (const table of tables) {
    assert.match(
      migration,
      new RegExp("alter table public\\." + table + " enable row level security;", "i"),
      table + " must have RLS enabled"
    );
  }
});

test("friend requests and friendships cannot be mutated through broad table grants", () => {
  assert.match(migration, /grant select on public\.friend_requests to authenticated;/i);
  assert.match(migration, /revoke update on public\.friend_requests from authenticated;/i);
  assert.match(migration, /grant select on public\.friendships to authenticated;/i);
  assert.doesNotMatch(migration, /grant[^;]*\b(insert|update|delete)\b[^;]*public\.friend_requests/i);
  assert.doesNotMatch(migration, /grant[^;]*\b(insert|update|delete)\b[^;]*public\.friendships/i);
  assert.doesNotMatch(migration, /create policy "Users can send friend requests as themselves"/i);
  assert.doesNotMatch(migration, /create policy "Recipients can respond to friend requests"/i);
  assert.doesNotMatch(migration, /create policy "Users can remove their own friendship edge"/i);
});

test("transactional public RPC wrappers exist for social and conversation actions", () => {
  for (const name of [
    "send_friend_request", "accept_friend_request", "decline_friend_request",
    "remove_friendship", "create_direct_conversation", "create_group_conversation"
  ]) {
    assert.match(migration, new RegExp("create or replace function public\\." + name + "\\(", "i"));
    assert.match(migration, new RegExp("grant execute on function public\\." + name + "\\(", "i"));
    assert.match(migration, new RegExp("revoke all on function public\\." + name + "\\([^;]* from public,anon;", "i"));
  }
});

test("browser Supabase client contains no server secret key", () => {
  assert.match(browserClient, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(browserClient, /SUPABASE_SECRET_KEY|service_role|sb_secret_/i);
});
