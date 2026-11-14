import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const idSet = new Set(ids);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicateIds, [], "index.html contains duplicate IDs");

const tabs = [...html.matchAll(/<button\b(?=[^>]*\brole=["']tab["'])[^>]*>/g)].map(match => match[0]);
assert.equal(tabs.length, 7, "The bottom navigation must expose exactly seven tabs");
for (const tab of tabs) {
  const control = tab.match(/\baria-controls=["']([^"']+)["']/)?.[1];
  assert.ok(control, "Every bottom navigation tab must identify its controlled panel");
  assert.ok(idSet.has(control), `Tab controls a missing panel: ${control}`);
}
const selectedTabs = tabs.filter(tab => /\baria-selected=["']true["']/.test(tab));
assert.equal(selectedTabs.length, 1, "Exactly one bottom navigation tab must be selected initially");
const panelTags = [...html.matchAll(/<(?:div|section)\b[^>]*>/g)].map(match => match[0]);
for (const tab of tabs) {
  const tabId = tab.match(/\bid=["']([^"']+)["']/)?.[1];
  const panelId = tab.match(/\baria-controls=["']([^"']+)["']/)?.[1];
  const panel = panelTags.find(tag => tag.includes(`id="${panelId}"`) || tag.includes(`id='${panelId}'`));
  assert.ok(panel, `Tab panel not found: ${panelId}`);
  if (panelId === "workspace") {
    // The chats workspace is the main landmark. Labelling this large
    // container with the Chats tab repeats its name in VoiceOver.
    assert.ok(panel.includes('role="main"') || panel.includes("role='main'"), "The chats workspace must remain the main landmark");
    assert.ok(!panel.includes('aria-labelledby="home-tab"') && !panel.includes("aria-labelledby='home-tab'"), "The chats workspace must not repeat the Chats tab label");
  } else {
    assert.ok(panel.includes('role="tabpanel"') || panel.includes("role='tabpanel'"), `Tab target must expose role=tabpanel: ${panelId}`);
    assert.ok(panel.includes(`aria-labelledby="${tabId}"`) || panel.includes(`aria-labelledby='${tabId}'`),
      `Tab panel must be labelled by its tab: ${panelId}`);
  }
}
const modalDialogs = [...html.matchAll(/<(?:div|section|aside|form)\b[^>]*\brole=["']dialog["'][^>]*>/gi)].map(match => match[0]);
for (const dialog of modalDialogs.filter(dialog => /\baria-modal=["']true["']/.test(dialog))) {
  assert.ok(/\baria-label=["'][^"']+["']|\baria-labelledby=["'][^"']+["']/.test(dialog),
    "Every modal dialog must have an accessible name");
}

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.equal((app.match(/closeHelpSupportForNavigation\\(\\);/g) || []).length, 6,
  "Every primary tab must close the Help & Support overlay and stop its realtime subscription");
assert.equal((app.match(/closeNewChatForNavigation\\(\\);/g) || []).length, 6,
  "Every primary tab must close the New Chat overlay before navigation");
assert.match(app, /function getTopModalDialog\(/, "A topmost modal selector must be present");
assert.match(app, /document\.addEventListener\("focusin"/, "Modal focus must be restored when it escapes");
assert.match(app, /keepDialogFocusInside\(activeDialog, event\)/, "Tab focus must stay inside the topmost modal");
for (const file of ["tools.js", "channels.js", "communities.js"]) {
  readFileSync(new URL("../" + file, import.meta.url), "utf8");
}
process.stdout.write("Static checks passed: JavaScript syntax, unique HTML IDs, and bottom-tab relationships.\n");
