"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(
  path.join(__dirname, "..", "supabase-auth-preview.html"),
  "utf8"
);

test("Supabase OAuth preview is isolated from the production login page", () => {
  assert.match(page, /supabase\.auth\.signInWithOAuth/);
  assert.match(page, /supabase-auth-preview\.html/);
  assert.doesNotMatch(page, /location\.(replace|assign)\(["']chat\.html/);
  assert.doesNotMatch(page, /firebase/i);
});

test("OAuth preview verifies the profile and reports missing migration clearly", () => {
  assert.match(page, /from\("profiles"\)/);
  assert.match(page, /maybeSingle\(\)/);
  assert.match(page, /الملف الشخصي غير موجود/);
  assert.match(page, /role="status" aria-live="polite"/);
  assert.match(page, /signOut\(\)/);
});
