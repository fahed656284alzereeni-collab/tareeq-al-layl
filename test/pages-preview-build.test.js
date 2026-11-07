import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "build-pages-preview.mjs");

test("Pages preview build publishes only the isolated Supabase Auth smoke test", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "mersal-pages-preview-"));
  try {
    execFileSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, PAGES_PREVIEW_OUT_DIR: output },
      stdio: "pipe"
    });
    const files = (await readdir(output)).sort();
    assert.deepEqual(files, ["index.html", "supabase-auth-preview.html", "supabase-client.js"]);
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.match(html, /تسجيل الدخول باستخدام Google/);
    assert.match(html, /supabase-client\.js/);
    assert.doesNotMatch(html, /supabase-chat-preview\.html|chatPreview/);
    assert.doesNotMatch(html, /onrender\.com|firebase-admin|service_role|SUPABASE_SECRET_KEY/i);
    const client = await readFile(path.join(output, "supabase-client.js"), "utf8");
    assert.match(client, /SUPABASE_PUBLISHABLE_KEY/);
    assert.doesNotMatch(client, /SUPABASE_SECRET_KEY|service_role/i);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
