"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20261107100410_mersal_auth_profile_bootstrap.sql"),
  "utf8"
);

test("new Supabase Auth users receive a profile through a database trigger", () => {
  assert.match(migration, /create or replace function private\.handle_new_auth_user\(\)/i);
  assert.match(migration, /security definer\s+set search_path\s*=\s*''/i);
  assert.match(migration, /insert into public\.profiles\s*\(id, display_name, avatar_url\)/i);
  assert.match(migration, /on conflict \(id\) do nothing/i);
  assert.match(migration, /after insert on auth\.users/i);
  assert.match(migration, /revoke all on function private\.handle_new_auth_user\(\) from public, anon, authenticated/i);
});

test("profile bootstrap uses bounded display names and supported Google metadata", () => {
  assert.match(migration, /raw_user_meta_data/i);
  assert.match(migration, /full_name/i);
  assert.match(migration, /avatar_url/i);
  assert.match(migration, /picture/i);
  assert.match(migration, /left\([\s\S]*?,\s*30\s*\)/i);
});
