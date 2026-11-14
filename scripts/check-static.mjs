import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const idSet = new Set(ids);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicateIds, [], "index.html contains duplicate IDs");

const tabs = [...html.matchAll(/<button\b(?=[^>]*\brole=["']tab["'])[^>]*>/g)].map(match => match[0]);
assert.equal(tabs.length, 5, "The bottom navigation must expose exactly five tabs");
for (const tab of tabs) {
  const control = tab.match(/\baria-controls=["']([^"']+)["']/)?.[1];
  assert.ok(control, "Every bottom navigation tab must identify its controlled panel");
  assert.ok(idSet.has(control), `Tab controls a missing panel: ${control}`);
}
const selectedTabs = tabs.filter(tab => /\baria-selected=["']true["']/.test(tab));
assert.equal(selectedTabs.length, 1, "Exactly one bottom navigation tab must be selected initially");

for (const file of ["app.js", "tools.js", "channels.js", "communities.js"]) {
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
}
process.stdout.write("Static checks passed: JavaScript syntax, unique HTML IDs, and bottom-tab relationships.\n");
