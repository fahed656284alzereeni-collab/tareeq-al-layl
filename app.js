import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});

const $ = (selector) => document.querySelector(selector);
const authPanel = $("#auth-panel");
const workspace = $("#workspace");
const account = $("#account");
const status = $("#status");
const loginButton = $("#google-login");
const logoutButton = $("#logout");
const settingsButton = $("#settings-button");
const settingsPanel = $("#settings-panel");
const settingsForm = $("#settings-form");
const displayNameInput = $("#settings-display-name");
const textSizeSelect = $("#settings-text-size");
const themeSelect = $("#settings-theme");
const settingsEmail = $("#settings-email");
const closeSettingsButton = $("#close-settings");
const settingsHome = $("#settings-home");
const accountSettingsView = $("#account-settings-view");
const accountLogoutButton = $("#account-logout");
const refreshDataButton = $("#refresh-data");
let settingsReturnFocus = null;
const peopleSearch = $("#people-search");
const peopleList = $("#people-list");
const conversationList = $("#conversation-list");
const notificationsToggle = $("#notifications-toggle");
const notificationsPanel = $("#notifications-panel");
const notificationsList = $("#notifications-list");
const notificationCount = $("#notification-count");
const markAllReadButton = $("#mark-all-read");
const chatEmpty = $("#chat-empty");
const chatView = $("#chat-view");
const chatTitle = $("#chat-title");
const messagesList = $("#messages");
const messageForm = $("#message-form");
const messageInput = $("#message-input");
const sendButton = $("#send-button");
let currentUser = null;
let activeConversation = null;
let activePartner = null;
let people = [];
let conversations = [];
let realtimeChannel = null;
let presenceChannel = null;
let onlineUserIds = new Set();
let notifications = [];
let notificationChannel = null;

function announce(message, kind = "info") {
  status.textContent = message;
  status.dataset.kind = kind;
}
function getCallbackParams() {
  const params = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashQuery = rawHash.includes("?") ? rawHash.slice(rawHash.indexOf("?") + 1) : rawHash;
  for (const [key, value] of new URLSearchParams(hashQuery)) {
    if (!params.has(key)) params.set(key, value);
  }
  return params;
}
function displayName(profile) {
  return profile?.display_name?.trim() || "مستخدم مرسال";
}
function safeText(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value ?? "";
  return node;
}
function showLoggedOut(message = "لم يتم تسجيل الدخول. يمكنك المحاولة مرة أخرى باستخدام Google.") {
  settingsPanel.hidden = true;
  settingsButton.hidden = true;
  currentUser = null;
  activeConversation = null;
  activePartner = null;
  authPanel.hidden = false;
  workspace.hidden = true;
  logoutButton.hidden = true;
  account.textContent = "غير مسجل الدخول";
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  if (presenceChannel) supabase.removeChannel(presenceChannel);
  if (notificationChannel) supabase.removeChannel(notificationChannel);
  realtimeChannel = null;
  presenceChannel = null;
  notificationChannel = null;
  notifications = [];
  onlineUserIds = new Set();
  announce(message, "error");
}
async function ensureProfile(user) {
  const { data: existing, error: readError } = await supabase.from("profiles")
    .select("id").eq("id", user.id).maybeSingle();
  if (readError) throw readError;
  if (existing) return;
  const metadata = user.user_metadata || {};
  const name = metadata.full_name || metadata.name || user.email?.split("@")[0] || "مستخدم مرسال";
  const avatar = metadata.avatar_url || metadata.picture || null;
  const { error } = await supabase.from("profiles").insert({
    id: user.id, display_name: name, avatar_url: avatar, updated_at: new Date().toISOString()
  });
  if (error && error.code !== "23505") throw error;
}
async function handleSession(session) {
  if (!session?.user) {
    const callbackParams = getCallbackParams();
    if (callbackParams.has("code")) {
      showLoggedOut("رجعت من Google، لكن مرسال لم يستلم جلسة الدخول. هذا يعني أن إكمال تسجيل الدخول تعثّر بعد الرجوع من Google.");
    } else {
      showLoggedOut();
    }
    return;
  }
  const alreadyLoadedForThisUser = currentUser?.id === session.user.id && !workspace.hidden;
  currentUser = session.user;
  authPanel.hidden = true;
  workspace.hidden = false;
  logoutButton.hidden = true;
  settingsButton.hidden = false;
  account.textContent = "مرحبًا بك في مرسال · متصل الآن";
  try {
    if (!alreadyLoadedForThisUser) {
      await ensureProfile(session.user);
      await Promise.all([loadPeople(), loadConversations(), loadNotifications()]);
      await loadOwnProfile();
    }
    await startPresence();
    startNotificationsRealtime();
    announce("تم تسجيل الدخول. يمكنك بدء محادثة جديدة.");
  } catch (error) {
    announce("تعذر تحميل الحساب: " + (error.message || "خطأ غير معروف"), "error");
  }
}

async function startPresence() {
  if (!currentUser) return;
  if (presenceChannel) await supabase.removeChannel(presenceChannel);
  presenceChannel = supabase.channel("mersal-online", { config: { presence: { key: currentUser.id } } });
  presenceChannel.on("presence", { event: "sync" }, () => {
    onlineUserIds = new Set(Object.keys(presenceChannel.presenceState()));
    void loadPeople().catch(error => announce("تعذر تحديث الأشخاص المتصلين: " + error.message, "error"));
  });
  presenceChannel.subscribe(async (state) => {
    if (state === "SUBSCRIBED" && currentUser) {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", currentUser.id).maybeSingle();
      await presenceChannel.track({ user_id: currentUser.id, display_name: data?.display_name || "مستخدم مرسال" });
    }
  });
}

async function loadNotifications() {
  if (!currentUser) return;
  const { data, error } = await supabase.from("notifications")
    .select("id,recipient_id,sender_id,conversation_id,message_id,preview,created_at,read_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  notifications = data || [];
  const senderIds = [...new Set(notifications.map(item => item.sender_id))];
  let profileMap = new Map();
  if (senderIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles")
      .select("id,display_name").in("id", senderIds);
    if (profileError) throw profileError;
    profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
  }
  renderNotifications(profileMap);
}
function renderNotifications(profileMap = new Map()) {
  notificationsList.replaceChildren();
  const unread = notifications.filter(item => !item.read_at).length;
  notificationCount.hidden = unread === 0;
  notificationCount.textContent = String(unread);
  notificationsToggle.setAttribute("aria-label", unread ? "الإشعارات، " + unread + " غير مقروءة" : "الإشعارات");
  markAllReadButton.hidden = unread === 0;
  if (!notifications.length) {
    notificationsList.append(safeText("li", "empty-item", "لا توجد إشعارات بعد."));
    return;
  }
  for (const notification of notifications) {
    const sender = profileMap.get(notification.sender_id) || { display_name: "مستخدم مرسال" };
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "notification-item" + (notification.read_at ? " is-read" : " is-unread");
    button.setAttribute("aria-label", (notification.read_at ? "مقروء: " : "غير مقروء: ") + displayName(sender) + ". " + (notification.preview || "أرسل رسالة جديدة"));
    button.append(safeText("span", "notification-sender", displayName(sender)));
    button.append(safeText("span", "notification-preview", notification.preview || "أرسل رسالة جديدة"));
    button.append(safeText("time", "notification-time", new Date(notification.created_at).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "short" })));
    button.addEventListener("click", () => { void openNotification(notification, sender); });
    item.append(button);
    notificationsList.append(item);
  }
}
async function openNotification(notification, sender) {
  if (!currentUser) return;
  notificationsPanel.hidden = true;
  notificationsToggle.setAttribute("aria-expanded", "false");
  const { data: conversation, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,last_message_at")
    .eq("id", notification.conversation_id).single();
  if (error) {
    announce("تعذر فتح المحادثة من الإشعار: " + error.message, "error");
    return;
  }
  await selectConversation(conversation, sender);
}
function startNotificationsRealtime() {
  if (!currentUser) return;
  if (notificationChannel) void supabase.removeChannel(notificationChannel);
  notificationChannel = supabase.channel("notifications-" + currentUser.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "notifications",
      filter: "recipient_id=eq." + currentUser.id
    }, async (payload) => {
      try {
        await loadNotifications();
        const { data } = await supabase.from("profiles").select("display_name")
          .eq("id", payload.new.sender_id).maybeSingle();
        announce("إشعار جديد من " + (data?.display_name || "مستخدم مرسال"));
      } catch (error) {
        announce("وصلك إشعار جديد، لكن تعذر تحديث القائمة: " + error.message, "error");
      }
    })
    .subscribe();
}
notificationsToggle.addEventListener("click", async () => {
  const opening = notificationsPanel.hidden;
  notificationsPanel.hidden = !opening;
  notificationsToggle.setAttribute("aria-expanded", String(opening));
  if (opening) {
    try { await loadNotifications(); }
    catch (error) { announce("تعذر تحميل الإشعارات: " + error.message, "error"); }
  }
});
markAllReadButton.addEventListener("click", async () => {
  markAllReadButton.disabled = true;
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) announce("تعذر تحديث الإشعارات: " + error.message, "error");
  else {
    await loadNotifications();
    announce("تم تحديد الإشعارات كمقروءة.");
  }
  markAllReadButton.disabled = false;
});
async function markConversationNotificationsRead(conversationId) {
  if (!currentUser) return;
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId).is("read_at", null);
  if (error) throw error;
  await loadNotifications();
}

function applyTextSize(size) {
  document.documentElement.classList.remove("text-large", "text-xlarge");
  if (size === "large") document.documentElement.classList.add("text-large");
  if (size === "xlarge") document.documentElement.classList.add("text-xlarge");
}

function applyTheme(choice) {
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  const resolved = choice === "system" ? (prefersLight ? "light" : "dark") : choice;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeChoice = choice;
}

function openSettings() {
  if (!currentUser) return;
  settingsReturnFocus = document.activeElement;
  settingsEmail.value = currentUser.email || "";
  textSizeSelect.value = localStorage.getItem("mersal-text-size") || "normal";
  themeSelect.value = localStorage.getItem("mersal-theme") || "system";
  applyTextSize(textSizeSelect.value);
  applyTheme(themeSelect.value);
  settingsHome.hidden = false;
  accountSettingsView.hidden = true;
  settingsPanel.hidden = false;
  displayNameInput.focus();
}
async function loadOwnProfile() {
  const { data, error } = await supabase.from("profiles")
    .select("display_name").eq("id", currentUser.id).maybeSingle();
  if (error) throw error;
  displayNameInput.value = data?.display_name || currentUser.email?.split("@")[0] || "";
}
settingsButton.addEventListener("click", openSettings);
$("#open-account-settings").addEventListener("click", () => { settingsHome.hidden = true; accountSettingsView.hidden = false; displayNameInput.focus(); });
$("#back-settings-home").addEventListener("click", () => { accountSettingsView.hidden = true; settingsHome.hidden = false; $("#open-account-settings").focus(); });
accountLogoutButton.addEventListener("click", async () => { accountLogoutButton.disabled = true; const { error } = await supabase.auth.signOut(); if (error) announce("تعذر تسجيل الخروج: " + error.message, "error"); else { settingsPanel.hidden = true; announce("تم تسجيل الخروج."); } accountLogoutButton.disabled = false; });
settingsPanel.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    settingsPanel.hidden = true;
    settingsReturnFocus?.focus?.();
  }
});
closeSettingsButton.addEventListener("click", () => {
  settingsPanel.hidden = true;
  if (settingsReturnFocus?.focus) settingsReturnFocus.focus();
});
textSizeSelect.addEventListener("change", () => {
  applyTextSize(textSizeSelect.value);
  localStorage.setItem("mersal-text-size", textSizeSelect.value);
});
themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
  localStorage.setItem("mersal-theme", themeSelect.value);
});
window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => {
  if ((localStorage.getItem("mersal-theme") || "system") === "system") applyTheme("system");
});
settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const name = displayNameInput.value.trim();
  if (name.length < 2 || name.length > 40) {
    announce("الاسم يجب أن يكون بين حرفين و40 حرفًا.", "error");
    displayNameInput.focus();
    return;
  }
  const saveButton = $("#save-settings");
  saveButton.disabled = true;
  announce("جارٍ حفظ إعدادات الحساب…");
  const { error } = await supabase.from("profiles").update({
    display_name: name, updated_at: new Date().toISOString()
  }).eq("id", currentUser.id);
  if (error) {
    announce("تعذر حفظ الاسم: " + error.message, "error");
  } else {
    await Promise.all([loadPeople(), loadConversations()]);
    announce("تم حفظ إعداداتك بنجاح.", "success");
    settingsPanel.hidden = true;
    settingsReturnFocus?.focus?.();
  }
  saveButton.disabled = false;
});
refreshDataButton.addEventListener("click", async () => {
  refreshDataButton.disabled = true;
  try {
    await Promise.all([loadPeople(), loadConversations()]);
    announce("تم تحديث الأشخاص والمحادثات.", "success");
  } catch (error) {
    announce("تعذر تحديث البيانات: " + error.message, "error");
  }
  refreshDataButton.disabled = false;
});
applyTextSize(localStorage.getItem("mersal-text-size") || "normal");
applyTheme(localStorage.getItem("mersal-theme") || "system");

loginButton.addEventListener("click", async () => {
  loginButton.disabled = true;
  announce("جارٍ فتح Google لتسجيل الدخول…");
  try {
    const redirectTo = new URL("/", window.location.origin).toString();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) throw error;
  } catch (error) {
    announce("تعذر بدء تسجيل الدخول: " + (error?.message || "خطأ غير معروف"), "error");
    loginButton.disabled = false;
  }
});
logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  if (error) announce("تعذر تسجيل الخروج: " + error.message, "error");
  else announce("تم تسجيل الخروج.");
  logoutButton.disabled = false;
});
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
      void handleSession(session);
    }
  }, 0);
});

async function loadPeople() {
  const { data, error } = await supabase.from("profiles")
    .select("id,display_name,avatar_url")
    .neq("id", currentUser.id)
    .order("display_name", { ascending: true })
    .limit(100);
  if (error) throw error;
  people = data || [];
  renderPeople();
}
function renderPeople() {
  const term = peopleSearch.value.trim().toLocaleLowerCase();
  peopleList.replaceChildren();
  const filtered = people.filter(person => onlineUserIds.has(person.id) && displayName(person).toLocaleLowerCase().includes(term));
  if (!filtered.length) {
    peopleList.append(safeText("li", "empty-item", term ? "لا يوجد شخص متصل بهذا الاسم." : "لا يوجد أشخاص متصلون الآن."));
    return;
  }
  for (const person of filtered) {
    const item = document.createElement("li");
    const button = safeText("button", "person-button", displayName(person) + " · متصل الآن");
    button.type = "button";
    button.addEventListener("click", () => { void openConversation(person); });
    item.append(button);
    peopleList.append(item);
  }
}
peopleSearch.addEventListener("input", renderPeople);

async function loadConversations() {
  const { data, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,last_message_at")
    .or("user_one.eq." + currentUser.id + ",user_two.eq." + currentUser.id)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  conversations = data || [];
  const partnerIds = conversations.map(c => c.user_one === currentUser.id ? c.user_two : c.user_one);
  let profileMap = new Map();
  if (partnerIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles")
      .select("id,display_name").in("id", partnerIds);
    if (profileError) throw profileError;
    profileMap = new Map((profiles || []).map(p => [p.id, p]));
  }
  conversationList.replaceChildren();
  if (!conversations.length) {
    conversationList.append(safeText("li", "empty-item", "لا توجد محادثات بعد."));
    return;
  }
  for (const conversation of conversations) {
    const partnerId = conversation.user_one === currentUser.id ? conversation.user_two : conversation.user_one;
    const person = profileMap.get(partnerId) || { id: partnerId, display_name: "مستخدم مرسال" };
    const item = document.createElement("li");
    const button = safeText("button", "conversation-button", displayName(person));
    button.type = "button";
    button.addEventListener("click", () => { void selectConversation(conversation, person); });
    item.append(button);
    conversationList.append(item);
  }
}
async function openConversation(person) {
  if (!currentUser || person.id === currentUser.id) return;
  const [one, two] = [currentUser.id, person.id].sort();
  let { data, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,last_message_at")
    .eq("user_one", one).eq("user_two", two).maybeSingle();
  if (error) {
    announce("تعذر فتح المحادثة: " + error.message, "error");
    return;
  }
  if (!data) {
    const created = await supabase.from("conversations")
      .insert({ user_one: one, user_two: two })
      .select("id,user_one,user_two,last_message_at").single();
    if (created.error && created.error.code !== "23505") {
      announce("تعذر إنشاء المحادثة: " + created.error.message, "error");
      return;
    }
    data = created.data;
    if (!data) {
      const retry = await supabase.from("conversations")
        .select("id,user_one,user_two,last_message_at")
        .eq("user_one", one).eq("user_two", two).single();
      if (retry.error) {
        announce("تعذر استرجاع المحادثة: " + retry.error.message, "error");
        return;
      }
      data = retry.data;
    }
  }
  await selectConversation(data, person);
  await loadConversations();
}
async function selectConversation(conversation, person) {
  activeConversation = conversation;
  activePartner = person;
  chatEmpty.hidden = true;
  chatView.hidden = false;
  chatTitle.textContent = "محادثة مع " + displayName(person);
  await loadMessages();
  await markConversationNotificationsRead(conversation.id);
  if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel("messages-" + conversation.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: "conversation_id=eq." + conversation.id
    }, (payload) => appendMessage(payload.new))
    .subscribe((state) => {
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        announce("الاتصال المباشر بالرسائل غير مستقر. استخدم زر تحديث الرسائل للمزامنة.", "error");
      }
    });
  messageInput.focus();
}
function appendMessage(message) {
  if (!message || document.querySelector('[data-message-id="' + message.id + '"]')) return;
  messagesList.querySelectorAll(".empty-item").forEach(node => node.remove());
  const item = document.createElement("li");
  item.className = message.sender_id === currentUser.id ? "message mine" : "message theirs";
  item.dataset.messageId = message.id;
  item.append(safeText("p", "message-body", message.body));
  const time = new Date(message.created_at).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "short" });
  item.append(safeText("time", "message-time", time));
  messagesList.append(item);
  messagesList.scrollTop = messagesList.scrollHeight;
}
async function loadMessages() {
  if (!activeConversation) return;
  messagesList.replaceChildren();
  const { data, error } = await supabase.from("messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", activeConversation.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    announce("تعذر تحميل الرسائل: " + error.message, "error");
    return;
  }
  if (!data?.length) messagesList.append(safeText("li", "empty-item", "هذه بداية المحادثة. أرسل أول رسالة."));
  for (const message of data || []) appendMessage(message);
}
$("#refresh-chat").addEventListener("click", () => { void loadMessages(); });
messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = messageInput.value.trim();
  if (!body || !activeConversation || !currentUser) return;
  sendButton.disabled = true;
  const { data, error } = await supabase.from("messages").insert({
    conversation_id: activeConversation.id, sender_id: currentUser.id, body
  }).select("id,conversation_id,sender_id,body,created_at").single();
  if (error) {
    announce("تعذر إرسال الرسالة: " + error.message, "error");
  } else {
    messageInput.value = "";
    appendMessage(data);
    await loadConversations();
    announce("تم إرسال الرسالة.");
  }
  sendButton.disabled = false;
  messageInput.focus();
});

const { data: initial, error: initialError } = await supabase.auth.getSession();
if (initialError) {
  showLoggedOut("تعذر التحقق من الجلسة: " + initialError.message);
} else {
  await handleSession(initial.session);
}
const params = getCallbackParams();
if (params.has("error") || params.has("error_code")) {
  announce("فشل تسجيل الدخول: " + (params.get("error_description") || params.get("error_code") || params.get("error") || "رفض Google الطلب"), "error");
}
