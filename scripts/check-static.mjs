import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const idSet = new Set(ids);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
assert.deepEqual(duplicateIds, [], "index.html contains duplicate IDs");

const migrationFiles = readdirSync(new URL("../supabase/migrations/", import.meta.url))
  .filter(file => file.endsWith(".sql"));
assert.ok(migrationFiles.every(file => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)),
  "Every Supabase migration must use a 14-digit version and a snake_case name");
const migrationVersions = migrationFiles.map(file => file.slice(0, 14));
const duplicateMigrationVersions = [...new Set(migrationVersions.filter((version, index) => migrationVersions.indexOf(version) !== index))];
assert.deepEqual(duplicateMigrationVersions, [], "Supabase migration versions must be unique");

const tabs = [...html.matchAll(/<button\b(?=[^>]*\brole=["']tab["'])[^>]*>/g)].map(match => match[0]);
assert.equal(tabs.length, 7, "The bottom navigation must expose exactly seven tabs");
for (const tab of tabs) {
  const control = tab.match(/\baria-controls=["']([^"']+)["']/)?.[1];
  assert.ok(control, "Every bottom navigation tab must identify its controlled panel");
  assert.ok(idSet.has(control), `Tab controls a missing panel: ${control}`);
}
const selectedTabs = tabs.filter(tab => /\baria-selected=["']true["']/.test(tab));
assert.equal(selectedTabs.length, 1, "Exactly one bottom navigation tab must be selected initially");
assert.ok(tabs.every(tab => !/\baria-description=/.test(tab)), "Bottom navigation tabs must not add a description prefix to VoiceOver");
assert.doesNotMatch(html, /role=["\']status["\']|role=["\']group["\']|role=["\']main["\']/, "Avoid redundant VoiceOver status, group, and landmark announcements");
const panelTags = [...html.matchAll(/<(?:div|section)\b[^>]*>/g)].map(match => match[0]);
for (const tab of tabs) {
  const tabId = tab.match(/\bid=["']([^"']+)["']/)?.[1];
  const panelId = tab.match(/\baria-controls=["']([^"']+)["']/)?.[1];
  const panel = panelTags.find(tag => tag.includes(`id="${panelId}"`) || tag.includes(`id='${panelId}'`));
  assert.ok(panel, `Tab panel not found: ${panelId}`);
  if (panelId === "workspace") {
    // The chats workspace is the main landmark. Labelling this large
    // container with the Chats tab repeats its name in VoiceOver.
    assert.ok(!panel.includes('role="main"') && !panel.includes("role='main'"), "The chats workspace must not create a VoiceOver landmark announcement");
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


for (const id of ["privacy-policy-view", "terms-of-service-view"]) {
  const start = html.indexOf('id="' + id + '"');
  const end = html.indexOf('id="help-support-panel"', start);
  const legalPage = html.slice(start, end);
  assert.ok(start >= 0 && end > start, "Both legal pages must remain present");
  assert.doesNotMatch(legalPage, /<h[1-6]\\b|aria-labelledby=|role=["'](?:region|main|article)["']|<(?:article|section)\\b/i,
    "Legal pages must not expose heading levels or landmark/article semantics to VoiceOver: " + id);
  assert.match(legalPage, /legal-page-title|legal-section-title/, "Legal page titles must remain visible as plain text");
}

const baseCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
assert.ok(!baseCss.includes("body.calls-open #bottom-navigation { display:none !important; }"),
  "The primary tab bar must not be hidden while the calls tab is active");
assert.ok(baseCss.includes("grid-template-columns:repeat(7,minmax(0,1fr))"),
  "The base navigation layout must allocate space for all seven tabs");

const experienceCss = readFileSync(new URL("../mersal-experience-v2.css", import.meta.url), "utf8");
assert.match(experienceCss, /#bottom-navigation\s*\{[^}]*z-index:\s*220/s,
  "The primary tab bar must stay above full-screen tab panels");
assert.match(experienceCss, /body\.settings-open #bottom-navigation,[\s\S]*?display:\s*flex !important/,
  "The primary tab bar must remain visible while settings are open");
assert.doesNotMatch(experienceCss, /body\.calls-open \.topbar,\s*body\.calls-open #bottom-navigation/,
  "The calls full-screen rule must not hide the primary tab bar");

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /aria-posinset/, "Bottom navigation tabs must expose their position in the tab set");
assert.match(app, /aria-setsize/, "Bottom navigation tabs must expose the total tab count");
assert.match(app, /tab\.setAttribute\("aria-label", `\$\{label\}، \$\{index \+ 1\} من \$\{total\}`\)/, "Bottom navigation tabs must expose their accessible name and position as N of 7");
assert.match(app, /tab\.removeAttribute\("aria-description"\)/, "Bottom navigation tabs must not add an extra VoiceOver description announcement");
assert.doesNotMatch(app, /from\(["']profiles["']\)\s*\.select\(["'][^"']*(?:about|last_seen_at|created_at)/,
  "Private profile fields must be read through visibility-checked RPCs");
assert.match(app, /async function loadOwnProfile\(\)[\s\S]*?supabase\.rpc\("get_visible_profiles",\{p_user_ids:\[userId\]\}\)[\s\S]*?const profile = visibleProfile\.data\?\.\[0\] \|\| null;/,
  "Own profile details and avatar paths must use the privacy-checked profile RPC");
const groupInviteLoader = app.match(/async function loadGroupInviteLink\(conversationId,isAdmin\)\{[\s\S]*?\n\}/)?.[0] || "";
assert.ok(groupInviteLoader.includes("groupInviteShareButton.hidden=false"), "Group invite sharing must be independently exposed in conversation info");
assert.doesNotMatch(groupInviteLoader, /groupInviteShareButton\.hidden\s*=\s*true/, "Invite-link loading must not hide the independent group share action");
assert.ok(app.includes('if(groupInviteShareButton)groupInviteShareButton.addEventListener("click",async()=>'), "The standalone group share action must retry loading its invite link");
assert.match(html, /<div id="group-invite-share-card"[^>]*info-section-card">/,
  "The group share action must live in its own visible information card");
assert.ok(app.includes("if(groupInviteShareCard)groupInviteShareCard.hidden=false"),
  "Opening group information must reveal the standalone share card");
assert.doesNotMatch(html, /id="(?:calls-list|calls-history-list|status-list|channel-posts|community-posts)"[^>]*aria-live=/,
  "Content lists must not announce every inserted item automatically");
for (const id of ["calls-title", "channels-title", "communities-title"]) {
  assert.match(html, new RegExp('id="' + id + '"[^>]*aria-hidden="true"'),
    "Duplicate page titles must stay visual-only when the tab already names the panel: " + id);
}
assert.doesNotMatch(html, /aria-label="[^"]*علامة تبويب \d من 7"/, "Tab labels must not repeat tab role and position announcements");
assert.doesNotMatch(baseCss + "\\n" + experienceCss, /body\.chat-fullscreen[^}]*#bottom-navigation|body\.conversation-info-fullscreen[^}]*bottom-navigation/, "The bottom navigation must remain visible in chats and conversation info");
assert.ok(app.includes("let mersalTools =") && app.includes("mersalTools = initMersalTools("),
  "The core application must initialize its tools module");
assert.ok(app.includes("mersalChannels = initMersalChannels(") && app.includes("mersalCommunities = initMersalCommunities("),
  "The channels and communities modules must be initialized");
assert.ok(app.includes('settingsLanguageSelect.addEventListener("change"') && app.includes('openPrivacySettingsButton.addEventListener("click"'),
  "Settings controls must retain their event handlers");
assert.match(app, /async function loadConversations\(\) \{\s*const userId = currentUser\?\.id;[\s\S]*?const isCurrent = \(\) => loadConversations\.sequence === loadId && currentUser\?\.id === userId;[\s\S]*?if \(!isCurrent\(\)\) return;/,
  "Conversation list requests must be invalidated when a newer refresh or account switch occurs");
assert.match(app, /const baseConversations = data \|\| \[\];[\s\S]*?conversations = loadedConversations;/,
  "Conversation results must be committed only after the current request is validated");
assert.match(app, /Close every account-scoped view before showing the next account\.[\s\S]*?conversations = \[\];[\s\S]*?messagesList\.replaceChildren\(\);[\s\S]*?notificationsList\.replaceChildren\(\);/,
  "Switching accounts must clear the previous account's private interface state");
assert.match(app, /async function loadMessages\(\) \{\s*const userId = currentUser\?\.id;[\s\S]*?currentUser\?\.id === userId && activeConversation\?\.id === conversationId/,
  "Message loads must be invalidated when the active account or conversation changes");
assert.ok(app.includes("const isCurrent = () => loadPeople.sequence === requestId && currentUser?.id === userId;"),
  "People list requests must be invalidated when the active account changes");
assert.ok(app.includes('supabase.rpc("get_visible_profiles",{p_user_ids:[userId]})'),
  "Own profile settings must load the avatar path through the visibility-checked RPC");
assert.ok(app.includes("const isCurrent = () => loadOwnProfile.sequence === requestId && currentUser?.id === userId;"),
  "Own profile requests must not overwrite a different account's settings");
assert.ok(app.includes("const isCurrent = () => loadPrivacySettings.sequence === requestId && currentUser?.id === userId;"),
  "Privacy settings requests must not overwrite a different account's preferences");
assert.ok(app.includes("if (loadCallHistory.sequence !== requestId || currentUser?.id !== userId) return;"),
  "Call history requests must be invalidated when the active account changes");
assert.match(app, /async function updateCallLogStatus\(callLogId,statusValue\)[\s\S]*?\.update\(\{status:statusValue,ended_at:new Date\(\)\.toISOString\(\)\}\)/,
  "Call status updates must remain available after loading call history");
assert.equal((app.match(/closeHelpSupportForNavigation\(\);/g) || []).length, 8,
  "Every primary tab must close the Help & Support overlay and stop its realtime subscription");
assert.equal((app.match(/closeNewChatForNavigation\(\);/g) || []).length, 7,
  "Every primary tab must close the New Chat overlay before navigation");
assert.match(app, /\.in\("status", \["pending", "failed"\]\)/,
  "Scheduled messages must keep failed items visible to their sender");
assert.match(app, /scheduled\.failure_reason/,
  "Failed scheduled messages must show the reason they were not sent");
assert.match(app, /async function uploadAttachments\(fileList, options = \{\}\) \{[\s\S]*?const conversation = activeConversation;\s*const sender = currentUser;[\s\S]*?const path = conversation\.id \+ /,
  "Attachment uploads must remain bound to the conversation and account where they started");
assert.match(app, /if \(currentUser\?\.id !== sender\.id\) \{[\s\S]*?remove\(\[uploaded\.path\]\)[\s\S]*?تغيّر الحساب أثناء رفع الملف/,
  "An upload must be removed instead of being sent after the account changes");
assert.match(app, /let scheduledMessagesLoadSequence = 0;[\s\S]*?activeConversation\?\.id === conversationId && currentUser\?\.id === senderId && !scheduledMessagesPanel\.hidden/,
  "Scheduled-message results must not overwrite another conversation or closed panel");
assert.match(app, /conversation_id: conversation\.id,\s*sender_id: sender\.id,\s*body,\s*scheduled_at: scheduledAt\.toISOString\(\)[\s\S]*?if \(currentUser\?\.id === sender\.id && activeConversation\?\.id === conversation\.id && !messageSchedulePanel\.hidden\)/,
  "Finishing a scheduled send must not clear a different conversation's composer");
assert.match(app, /function getTopModalDialog\(/, "A topmost modal selector must be present");
assert.match(app, /document\.addEventListener\("focusin"/, "Modal focus must be restored when it escapes");
assert.match(app, /keepDialogFocusInside\(activeDialog, event\)/, "Tab focus must stay inside the topmost modal");
const channels = readFileSync(new URL("../channels.js", import.meta.url), "utf8");
assert.match(channels, /if \(activeChannel\?\.id !== channel\.id \|\| panel\.hidden \|\| getCurrentUser\(\)\?\.id !== user\.id\) return;/,
  "A late channel detail request must not replace the currently active page");
assert.match(channels, /if \(activeChannel\?\.id !== channelId \|\| detailView\.hidden\) return;/,
  "Late channel posts must not replace posts in another page");
assert.match(app, /openConversation\.sequence[\s\S]*?if \(!isCurrentRequest\(\)\) return;[\s\S]*?await selectConversation\(data, person\);/,
  "A stale contact lookup must not open a conversation after a newer selection");
assert.match(app, /loadNotifications\.sequence[\s\S]*?if \(!isCurrent\(\)\) return;[\s\S]*?notifications = loadedNotifications;/,
  "Notifications from an old account or request must not replace the current list");
assert.match(app, /async function openNotification\(notification, sender\)[\s\S]*?openNotification\.sequence[\s\S]*?if \(!isCurrent\(\)\) return;[\s\S]*?await selectConversation\(conversation, sender\);/,
  "Opening a notification must not switch accounts or conversations after a stale request");
assert.match(app, /function startNotificationsRealtime\(\) \{\s*const userId = currentUser\?\.id;[\s\S]*?if \(!isCurrent\(\)\) return;[\s\S]*?await loadNotifications\(\);[\s\S]*?if \(!isCurrent\(\)\) return;/,
  "A notification subscription from a previous account must not update the active account");
assert.match(app, /function startNotificationsRealtime\(\) \{\s*const userId = currentUser\?\.id;\s*if \(!userId\) return;\s*const isCurrent = \(\) =>[\s\S]*?table: "conversation_members",[\s\S]*?if \(!isCurrent\(\) \|\| !payload\.new\?\.conversation_id\) return;/,
  "Group-membership realtime events from an old account must be ignored");
assert.match(app, /table: "messages"[\s\S]*?\}, payload => \{\s*if \(!isCurrent\(\) \|\| !payload\.new\?\.is_deleted\) return;/,
  "Message realtime events from an old account must be ignored");
assert.match(app, /const loadId = \+\+statusLoadSequence;[\s\S]*?if \(loadId !== statusLoadSequence \|\| currentUser\?\.id !== userId\) return;/,
  "Stale status list requests must not overwrite a newer account or refresh");
assert.match(app, /const requestId = \+\+statusViewerRequestId;[\s\S]*?if \(!isCurrent\(\)\) return;/,
  "Late status viewer requests must not replace the currently selected status");
assert.match(app, /function closeStatusViewer\(\) \{\s*statusViewerRequestId\+\+;/,
  "Closing a status viewer must invalidate pending requests");
assert.match(channels, /await stopPostsRealtime\(\);\s*if \(activeChannel\?\.id !== channelId \|\| detailView\.hidden \|\| panel\.hidden\) return;/,
  "A delayed channel realtime subscription must not survive navigation");
assert.match(channels, /const loadId = \+\+listLoadSequence;[\s\S]*?if \(loadId !== listLoadSequence \|\| panel\.hidden \|\| getCurrentUser\(\)\?\.id !== user\.id\) return;/,
  "Late channel list loads must not overwrite a newer navigation or session");
const communities = readFileSync(new URL("../communities.js", import.meta.url), "utf8");
assert.ok(channels.includes('panel.removeAttribute("aria-label")') && communities.includes('panel.removeAttribute("aria-label")'),
  "Tab panels must use their existing aria-labelledby relationship without a duplicate label");
assert.ok(communities.includes('setAttr(postsList, "aria-label", "منشورات المجتمع", "Community posts")'),
  "Community posts must not be announced as advertisements");
assert.doesNotMatch(app, /setAttribute\("role",\s*"group"\)/, "Avoid redundant VoiceOver group announcements on generic content");
assert.doesNotMatch(app, /setAttribute\("role",\s*"status"\)/, "Avoid redundant status roles on static scheduled-message text");
assert.doesNotMatch(channels, /setAttribute\("role",\s*isError\s*\?\s*"alert"\s*:\s*"status"\)/, "Channel status updates must not create extra alert/status roles");
assert.doesNotMatch(communities, /setAttribute\("role",\s*error\s*\?\s*"alert"\s*:\s*"status"\)/, "Community status updates must not create extra alert/status roles");
assert.ok(!html.includes('<section id="channel-info-view"') && !html.includes('<section id="community-groups-section"'), "Informational containers must not create extra region landmarks");
assert.match(communities, /const loadId = \+\+listLoadSequence;[\s\S]*?if \(loadId !== listLoadSequence \|\| panel\.hidden \|\| getCurrentUser\(\)\?\.id !== user\.id\) return;/,
  "Late community list loads must not overwrite a newer navigation or session");
assert.match(communities, /if \(activeCommunity\?\.id !== community\.id \|\| panel\.hidden \|\| getCurrentUser\(\)\?\.id !== user\.id\) return;/,
  "A late community detail request must not replace the currently active page");
assert.match(communities, /if \(activeCommunity\?\.id !== communityId \|\| detailView\.hidden\) return;/,
  "Late community posts must not replace posts in another page");
assert.match(communities, /await stopRealtime\(\);\s*if \(activeCommunity\?\.id !== communityId \|\| detailView\.hidden \|\| panel\.hidden\) return;/,
  "A delayed community realtime subscription must not survive navigation");
assert.match(communities, /const communityId = activeCommunity\.id;[\s\S]*?\.eq\("community_id", communityId\)[\s\S]*?if \(activeCommunity\?\.id !== communityId \|\| detailView\.hidden \|\| panel\.hidden\) return;/,
  "Late community group lists must not replace data in another page");
assert.match(app, /async function loadBroadcastLists\(\)[\s\S]*?const userId = currentUser\?\.id;[\s\S]*?const loadId = \+\+broadcastListLoadSequence;[\s\S]*?currentUser\?\.id !== userId \|\| broadcastPanel\.hidden/,
  "Broadcast-list loads must be invalidated when the panel closes or the active account changes");
assert.match(app, /async function getOrCreateBroadcastConversation\(recipientId, ownerId\)[\s\S]*?\[ownerId, recipientId\]/,
  "Broadcast conversations must be created for the account that started the send");
assert.match(app, /async function sendBroadcastList\(list\)[\s\S]*?const senderId = currentUser\?\.id;[\s\S]*?currentUser\?\.id !== senderId[\s\S]*?sender_id: senderId/,
  "Broadcast sends must stop after an account switch");
assert.ok(app.includes("const isPlainTextMessage = !pollMessage && !stickerMessage && attachmentIndex < 0;"), "Message editing must exclude polls, stickers, and all attachments");
assert.ok(app.includes("if (message.sender_id === currentUser.id && isPlainTextMessage)"), "Only the sender may see edit on plain text messages");
readFileSync(new URL("../tools.js", import.meta.url), "utf8");
assert.match(app, /function resetAccountScopedPanels\(\)[\s\S]*?mersalChannels\.close\(\{ restoreFocus: false \}\)[\s\S]*?mersalCommunities\.close\(\{ restoreFocus: false \}\)[\s\S]*?resetBroadcastPanel\(\)/,
  "Account changes and logout must close account-scoped panels");
assert.match(app, /function showLoggedOut\([\s\S]*?resetAccountScopedPanels\(\)/,
  "Logging out must reset private panels");
assert.match(app, /if \(currentUser\?\.id && currentUser\.id !== session\.user\.id\) \{[\s\S]*?resetAccountScopedPanels\(\)/,
  "Switching accounts must reset private panels before loading the next account");
assert.match(app, /saveBroadcastListButton\.addEventListener\("click", async \(\) => \{\s*const ownerId = currentUser\?\.id;[\s\S]*?owner_id: ownerId[\s\S]*?currentUser\?\.id !== ownerId/,
  "Broadcast list creation must stay bound to the account that started it");
assert.match(channels, /function close\(\{ restoreFocus = true \} = \{\}\)[\s\S]*?rows = \[\];[\s\S]*?list\.replaceChildren\(\)/,
  "Closing channels must clear account-specific rendered state");
assert.match(communities, /function close\(\{ restoreFocus = true \} = \{\}\)[\s\S]*?communities = \[\];[\s\S]*?linkedCommunityGroups = \[\]/,
  "Closing communities must clear account-specific rendered state");
process.stdout.write("Static checks passed: JavaScript syntax, HTML IDs, navigation guards, account isolation, and large-file converter safeguards.\n");
