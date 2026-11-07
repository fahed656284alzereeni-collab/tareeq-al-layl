import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(process.env.PAGES_PREVIEW_OUT_DIR || path.join(root, "dist"));

const source = await readFile(path.join(root, "supabase-auth-preview.html"), "utf8");
const replacements = [
  ['  <p><a id="chatPreview" href="./supabase-chat-preview.html" hidden>فتح معاينة المحادثات</a></p>\n', ""],
  ['const chatPreviewLink = document.getElementById("chatPreview");\n', ""],
  ['      chatPreviewLink.hidden = false;\n', ""],
  ['  chatPreviewLink.hidden = true;\n', ""]
];

let html = source;
for (const [before, after] of replacements) {
  const count = html.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one occurrence while preparing auth-only Pages preview; found ${count}.`);
  }
  html = html.replace(before, after);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "index.html"), html, "utf8");
await writeFile(path.join(output, "supabase-auth-preview.html"), html, "utf8");
await cp(path.join(root, "supabase-client.js"), path.join(output, "supabase-client.js"));
console.log("Built isolated Supabase Auth preview in " + output);
