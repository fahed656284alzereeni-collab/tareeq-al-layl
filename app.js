import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";
const VAPID_PUBLIC_KEY = "BJ8N8a64oyzKOAgPPRhRU9jiP3XQoe4cXA16ku1Iuf_Mo4Ll2-jtYBLDyx69hZa5YhX1yN0hJ9NZRCX-bqIrHa4";
const serviceWorkerReady = "serviceWorker" in navigator
  ? navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).catch(error => { console.error("Service worker:", error); return null; })
  : Promise.resolve(null);
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});

const $ = (selector) => document.querySelector(selector);
const authPanel = $("#auth-panel");
const workspace = $("#workspace");
const account = $("#account");
const status = $("#status");
const loginButton = $("#google-login");
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
const accountLogoutButton = $("#account-logout-button");
const deleteAccountButton = $("#delete-account-button");
const deleteAccountPanel = $("#delete-account-panel");
const closeDeleteAccountButton = $("#close-delete-account");
const cancelDeleteAccountButton = $("#cancel-delete-account");
const deleteAccountConfirmation = $("#delete-account-confirmation");
const confirmDeleteAccountButton = $("#confirm-delete-account");
const refreshDataButton = $("#refresh-data");
const pushNotificationsButton = $("#enable-push-notifications");
const pushNotificationsHelp = $("#push-notifications-help");
let settingsReturnFocus = null;
const newChatButton=$("#new-chat-button"),newChatPanel=$("#new-chat-panel"),closeNewChatButton=$("#close-new-chat");
const privateChatView=$("#private-chat-view"),groupChatView=$("#group-chat-view"),groupNameInput=$("#group-name");
const groupPeopleSearch=$("#group-people-search"),groupPeopleList=$("#group-people-list"),createGroupButton=$("#create-group-button");
const newPrivateChatButton=$("#new-private-chat"),newGroupChatButton=$("#new-group-chat");
let selectedGroupMembers=new Set(),newChatReturnFocus=null;
const peopleSearch = $("#people-search");
const peopleList = $("#people-list");
const conversationList = $("#conversation-list");
const notificationsToggle = $("#notifications-toggle");
const notificationsPanel = $("#notifications-panel");
const closeNotificationsButton = $("#close-notifications");
const notificationsList = $("#notifications-list");
const notificationCount = $("#notification-count");
const markAllReadButton = $("#mark-all-read");
const chatEmpty = $("#chat-empty");
const chatView = $("#chat-view");
const backToChatsButton = $("#back-to-chats");
const conversationInfoToggle = $("#conversation-info-toggle");
const conversationInfoPanel = $("#conversation-info");
const closeConversationInfoButton = $("#close-conversation-info");
const conversationInfoName = $("#conversation-info-name");
const chatPartnerName = $("#chat-partner-name");
const chatPartnerAccessible = $("#chat-partner-accessible");
const chatPartnerPresence = $("#chat-partner-presence");
let activePartnerLastSeenAt = null;
let lastSeenHeartbeat = null;
const conversationInfoStatus = $("#conversation-info-status");
const conversationInfoCreated = $("#conversation-info-created");
const conversationInfoCount = $("#conversation-info-count");
const conversationInfoNameLabel = $("#conversation-info-name-label");
const conversationInfoStatusRow = $("#conversation-info-status-row");
const conversationInfoSearchButton = $("#conversation-info-search");
const conversationInfoExportButton = $("#conversation-info-export");
const conversationInfoMuteButton = $("#conversation-info-mute");
const conversationInfoClearButton = $("#conversation-info-clear");
const groupAdminTools = $("#group-admin-tools");
const groupRenameInput = $("#group-rename-input");
const groupRenameSaveButton = $("#group-rename-save");
const groupAddSearch = $("#group-add-search");
const groupAddPeople = $("#group-add-people");
const groupAddSelectedButton = $("#group-add-selected");
const groupMemberList = $("#group-member-list");
const groupLeaveButton = $("#group-leave");
let activeGroupMemberIds = new Set();
let selectedAdditionalMembers = new Set();
const conversationSearchArea = $("#conversation-search-area");
const conversationSearchInput = $("#conversation-search-input");
const conversationSearchStatus = $("#conversation-search-status");
const conversationSearchResults = $("#conversation-search-results");
const messagesList = $("#messages");
const messageForm = $("#message-form");
const messageInput = $("#message-input");
const sendButton = $("#send-button");
const attachButton = $("#attach-button");
const attachmentChooser = $("#attachment-chooser");
const closeAttachmentChooserButton = $("#close-attachment-chooser");
const imageFileInput = $("#image-file-input");
const videoFileInput = $("#video-file-input");
const documentFileInput = $("#document-file-input");
const attachmentViewer = document.createElement("section");
attachmentViewer.className = "attachment-viewer";
attachmentViewer.hidden = true;
attachmentViewer.setAttribute("role", "dialog");
attachmentViewer.setAttribute("aria-modal", "true");
attachmentViewer.setAttribute("aria-label", "عرض المرفق داخل المحادثة");
const attachmentViewerClose = safeText("button", "quiet-button attachment-viewer-close", "إغلاق العرض");
attachmentViewerClose.type = "button";
const attachmentViewerContent = document.createElement("div");
attachmentViewerContent.className = "attachment-viewer-content";
attachmentViewer.append(attachmentViewerClose, attachmentViewerContent);
document.body.append(attachmentViewer);
let attachmentViewerReturnFocus = null;
function closeAttachmentViewer() {
  attachmentViewer.hidden = true;
  attachmentViewerContent.replaceChildren();
  if (attachmentViewerReturnFocus?.isConnected) attachmentViewerReturnFocus.focus();
}
function openAttachmentViewer(url, type, name, trigger) {
  attachmentViewerReturnFocus = trigger;
  attachmentViewerContent.replaceChildren();
  const title = safeText("p", "attachment-viewer-title", name || "مرفق");
  attachmentViewerContent.append(title);
  if (type.startsWith("image/")) {
    const media = document.createElement("img");
    media.src = url; media.alt = name || "صورة مرفقة"; media.className = "attachment-viewer-image";
    attachmentViewerContent.append(media);
  } else if (type.startsWith("video/")) {
    const media = document.createElement("video");
    media.src = url; media.controls = true; media.playsInline = true; media.preload = "metadata";
    media.setAttribute("playsinline", ""); media.setAttribute("webkit-playsinline", "");
    media.setAttribute("aria-label", "تشغيل الفيديو داخل المحادثة");
    media.className = "attachment-viewer-video";
    attachmentViewerContent.append(media);
  } else {
    const frame = document.createElement("iframe");
    frame.src = url; frame.title = "عرض الملف داخل المحادثة: " + (name || "ملف مرفق");
    frame.className = "attachment-viewer-frame";
    attachmentViewerContent.append(frame);
    const download = safeText("a", "attachment-download", "تنزيل الملف");
    download.href = url; download.download = name || "attachment";
    attachmentViewerContent.append(download);
  }
  attachmentViewer.hidden = false;
  attachmentViewerClose.focus();
}
attachmentViewerClose.addEventListener("click", closeAttachmentViewer);
attachmentViewer.addEventListener("keydown", event => { if (event.key === "Escape") closeAttachmentViewer(); });
attachmentViewer.addEventListener("click", event => { if (event.target === attachmentViewer) closeAttachmentViewer(); });

const replyingTo = $("#replying-to");
const replyingToText = $("#replying-to-text");
const cancelReplyButton = $("#cancel-reply");
let replyingToMessage = null;
let currentUser = null;
let activeConversation = null;
let activePartner = null;
let activeConversationMuted = false;
let people = [];
let conversations = [];
let realtimeChannel = null;
let presenceChannel = null;
let onlineUserIds = new Set();
let notifications = [];
let notificationChannel = null;

let statusMessageTimer = null;
function announce(message, kind = "info") {
  if (statusMessageTimer) clearTimeout(statusMessageTimer);
  status.textContent = message;
  status.dataset.kind = kind;
  if (kind !== "error" && message) {
    const announcedMessage = message;
    statusMessageTimer = setTimeout(() => {
      if (status.textContent === announcedMessage && status.dataset.kind === kind) {
        status.textContent = "";
        status.dataset.kind = "";
      }
      statusMessageTimer = null;
    }, 2000);
  }
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
  document.body.classList.remove("chat-fullscreen");
  workspace.classList.remove("chat-open");
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  currentUser = null;
  activeConversation = null;
  activePartner = null;
  authPanel.hidden = false;
  workspace.hidden = true;
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
async function handleSession(session, authEvent = "UNKNOWN") {
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
  void syncPushNotificationState();
  void touchLastSeen();
  if (!lastSeenHeartbeat) lastSeenHeartbeat = window.setInterval(() => { if (document.visibilityState === "visible") void touchLastSeen(); }, 60000);
  authPanel.hidden = true;
  workspace.hidden = false;
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
    if (!alreadyLoadedForThisUser && authEvent !== "TOKEN_REFRESHED") {
      announce("تم تسجيل الدخول. يمكنك بدء محادثة جديدة.");
    }
  } catch (error) {
    announce("تعذر تحميل الحساب: " + (error.message || "خطأ غير معروف"), "error");
  }
}

async function touchLastSeen() {
  if (!currentUser) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("profiles").update({ last_seen_at: now }).eq("id", currentUser.id);
  if (error) console.warn("تعذر تحديث آخر ظهور:", error.message);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void touchLastSeen();
});

function formatLastSeen(value) {
  if (!value) return "آخر ظهور غير متوفر";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString("ar-JO", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return "آخر ظهور اليوم الساعة " + time;
  if (sameYesterday) return "آخر ظهور أمس الساعة " + time;
  return "آخر ظهور " + date.toLocaleDateString("ar-JO", { day: "numeric", month: "long" }) + " الساعة " + time;
}
function updateChatPartnerPresence() {
  if (!activePartner || !chatPartnerPresence) return;
  const online = onlineUserIds.has(activePartner.id);
  chatPartnerPresence.textContent = online ? "متصل الآن" : formatLastSeen(activePartnerLastSeenAt);
  chatPartnerPresence.classList.toggle("is-online", online);
  chatPartnerPresence.classList.toggle("is-offline", !online);
  chatPartnerAccessible.setAttribute("aria-label", `${chatPartnerName.textContent}، ${chatPartnerPresence.textContent}`);
}

async function startPresence() {
  if (!currentUser) return;
  if (presenceChannel) await supabase.removeChannel(presenceChannel);
  presenceChannel = supabase.channel("mersal-online", { config: { presence: { key: currentUser.id } } });
  presenceChannel.on("presence", { event: "sync" }, () => {
    onlineUserIds = new Set(Object.keys(presenceChannel.presenceState()));
    updateChatPartnerPresence();
    void Promise.all([loadPeople(), loadConversations()]).catch(error => announce("تعذر تحديث حالة الاتصال: " + error.message, "error"));
  });
  presenceChannel.subscribe(async (state) => {
    if (state === "SUBSCRIBED" && currentUser) {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", currentUser.id).maybeSingle();
      await presenceChannel.track({ user_id: currentUser.id, display_name: data?.display_name || "مستخدم مرسال" });
    }
  });
}

async function syncPushNotificationState() {
  if (!currentUser) return;
  if (!("Notification" in window) || !("PushManager" in window)) {
    pushNotificationsButton.textContent = "إشعارات الهاتف غير مدعومة";
    pushNotificationsButton.disabled = true;
    return;
  }
  try {
    const registration = await serviceWorkerReady;
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (Notification.permission === "granted" && subscription) {
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: currentUser.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON()
      }, { onConflict: "endpoint" });
      if (error) throw error;
      pushNotificationsButton.textContent = "إيقاف إشعارات الهاتف";
      pushNotificationsHelp.textContent = "إشعارات الهاتف مفعّلة على هذا الجهاز.";
      pushNotificationsButton.disabled = false;
      pushNotificationsButton.setAttribute("aria-pressed", "true");
      return;
    }
    pushNotificationsButton.textContent = "تشغيل إشعارات الهاتف";
    pushNotificationsButton.disabled = false;
    pushNotificationsButton.setAttribute("aria-pressed", "false");
    if (Notification.permission === "denied") {
      pushNotificationsHelp.textContent = "الإشعارات محظورة من إعدادات الجهاز. اسمح بها لمرسال من إعدادات الإشعارات.";
    } else if (Notification.permission === "granted") {
      pushNotificationsHelp.textContent = "الإشعارات متوقفة على هذا الجهاز. يمكنك تشغيلها من هنا.";
    } else {
      pushNotificationsHelp.textContent = "يمكنك تشغيل إشعارات الرسائل أو إيقافها من هذا الزر.";
    }
  } catch (error) {
    console.warn("Could not restore push notification state:", error);
    pushNotificationsButton.textContent = "تشغيل إشعارات الهاتف";
    pushNotificationsButton.disabled = false;
    pushNotificationsButton.setAttribute("aria-pressed", "false");
  }
}

function applicationServerKeyFromBase64(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

pushNotificationsButton.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!("Notification" in window) || !("PushManager" in window)) {
    pushNotificationsHelp.textContent = "هذا المتصفح لا يدعم إشعارات الهاتف.";
    return;
  }
  pushNotificationsButton.disabled = true;
  try {
    const registration = await serviceWorkerReady;
    if (!registration) throw new Error("تعذر تجهيز خدمة الإشعارات.");
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      const { error } = await supabase.from("push_subscriptions")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("endpoint", existingSubscription.endpoint);
      if (error) throw error;
      const unsubscribed = await existingSubscription.unsubscribe();
      if (!unsubscribed) throw new Error("لم يتم إيقاف اشتراك الإشعارات. حاول مرة أخرى.");
      pushNotificationsButton.textContent = "تشغيل إشعارات الهاتف";
      pushNotificationsButton.setAttribute("aria-pressed", "false");
      pushNotificationsHelp.textContent = "تم إيقاف إشعارات الهاتف على هذا الجهاز.";
      pushNotificationsButton.disabled = false;
      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (isIOS && !isInstalled) {
      pushNotificationsHelp.textContent = "أضف مرسال إلى الشاشة الرئيسية أولًا، ثم افتحه من الأيقونة وشغّل الإشعارات من هنا.";
      pushNotificationsButton.disabled = false;
      return;
    }
    if (Notification.permission === "denied") {
      pushNotificationsHelp.textContent = "الإشعارات محظورة من إعدادات الجهاز. اسمح بها لمرسال من إعدادات الإشعارات ثم أعد المحاولة.";
      pushNotificationsButton.disabled = false;
      return;
    }
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") {
      pushNotificationsHelp.textContent = "لم يتم السماح بالإشعارات. يمكنك تفعيلها من إعدادات الجهاز.";
      pushNotificationsButton.disabled = false;
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKeyFromBase64(VAPID_PUBLIC_KEY)
    });
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: currentUser.id,
      endpoint: subscription.endpoint,
      subscription: subscription.toJSON()
    }, { onConflict: "endpoint" });
    if (error) {
      await subscription.unsubscribe();
      throw error;
    }
    pushNotificationsButton.textContent = "إيقاف إشعارات الهاتف";
    pushNotificationsButton.setAttribute("aria-pressed", "true");
    pushNotificationsHelp.textContent = "تم تشغيل إشعارات الهاتف على هذا الجهاز.";
    pushNotificationsButton.disabled = false;
  } catch (error) {
    pushNotificationsHelp.textContent = "تعذر تغيير إعداد الإشعارات: " + (error.message || "حاول مرة أخرى.");
    pushNotificationsButton.disabled = false;
    await syncPushNotificationState();
  }
});

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
  const { data: conversation, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,created_at,last_message_at")
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
function closeNotifications() {
  if (notificationsPanel.hidden) return;
  notificationsPanel.hidden = true;
  notificationsToggle.focus();
}
notificationsToggle.addEventListener("click", async () => {
  const opening = notificationsPanel.hidden;
  notificationsPanel.hidden = !opening;
  if (opening) {
    closeNotificationsButton.focus();
    try { await loadNotifications(); }
    catch (error) { announce("تعذر تحميل الإشعارات: " + error.message, "error"); }
  }
});
closeNotificationsButton.addEventListener("click", closeNotifications);
notificationsPanel.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeNotifications();
  }
});
markAllReadButton.addEventListener("click", async () => {
  markAllReadButton.disabled = true;
  const { error } = await supabase.from("notifications")
    .update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) announce("تعذر تحديث الإشعارات: " + error.message, "error");
  else {
    await loadNotifications();
    announce("تم التحديد.", "success");
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
accountLogoutButton.addEventListener("click", async () => {
  accountLogoutButton.disabled = true;
  const { error } = await supabase.auth.signOut();
  if (error) announce("تعذر تسجيل الخروج: " + error.message, "error");
  else {
    settingsPanel.hidden = true;
    showLoggedOut("تم تسجيل الخروج.");
  }
  accountLogoutButton.disabled = false;
});
function openDeleteAccountPanel() {
  deleteAccountConfirmation.value = "";
  confirmDeleteAccountButton.disabled = true;
  deleteAccountPanel.hidden = false;
  deleteAccountConfirmation.focus();
}
function closeDeleteAccountPanel() {
  deleteAccountPanel.hidden = true;
  deleteAccountButton.focus();
}
deleteAccountButton.addEventListener("click", openDeleteAccountPanel);
closeDeleteAccountButton.addEventListener("click", closeDeleteAccountPanel);
cancelDeleteAccountButton.addEventListener("click", closeDeleteAccountPanel);
deleteAccountConfirmation.addEventListener("input", () => {
  confirmDeleteAccountButton.disabled = deleteAccountConfirmation.value.trim() !== "حذف حسابي";
});
deleteAccountPanel.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDeleteAccountPanel();
});
confirmDeleteAccountButton.addEventListener("click", async () => {
  if (!currentUser || deleteAccountConfirmation.value.trim() !== "حذف حسابي") return;
  confirmDeleteAccountButton.disabled = true;
  closeDeleteAccountButton.disabled = true;
  cancelDeleteAccountButton.disabled = true;
  try {
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "حذف حسابي" }
    });
    if (error) throw error;
    deleteAccountPanel.hidden = true;
    await supabase.auth.signOut();
    showLoggedOut("تم حذف الحساب نهائيًا.");
  } catch (error) {
    announce("تعذر حذف الحساب: " + (error?.message || "حاول مرة أخرى."), "error");
    confirmDeleteAccountButton.disabled = false;
  } finally {
    closeDeleteAccountButton.disabled = false;
    cancelDeleteAccountButton.disabled = false;
  }
});
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
    announce("تم الحفظ.", "success");
    settingsPanel.hidden = true;
    settingsReturnFocus?.focus?.();
  }
  saveButton.disabled = false;
});
refreshDataButton.addEventListener("click", async () => {
  refreshDataButton.disabled = true;
  try {
    await Promise.all([loadPeople(), loadConversations()]);
    announce("تم التحديث.", "success");
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

supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(() => {
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
      void handleSession(session, event);
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
 const term=peopleSearch.value.trim().toLocaleLowerCase();peopleList.replaceChildren();
 const filtered=people.filter(p=>displayName(p).toLocaleLowerCase().includes(term));
 if(!filtered.length){peopleList.append(safeText("li","empty-item","لا يوجد أشخاص بهذا الاسم."));return;}
 for(const person of filtered){const item=document.createElement("li"),button=safeText("button","person-button",displayName(person)+(onlineUserIds.has(person.id)?" · متصل الآن":""));button.type="button";button.addEventListener("click",()=>{closeNewChat();void openConversation(person);});item.append(button);peopleList.append(item);}
}
function renderGroupPeople(){
 const term=groupPeopleSearch.value.trim().toLocaleLowerCase();groupPeopleList.replaceChildren();
 const filtered=people.filter(p=>displayName(p).toLocaleLowerCase().includes(term));
 if(!filtered.length){groupPeopleList.append(safeText("li","empty-item","لا يوجد أشخاص بهذا الاسم."));return;}
 for(const person of filtered){const item=document.createElement("li"),label=document.createElement("label");label.className="group-person-choice";const cb=document.createElement("input");cb.type="checkbox";cb.checked=selectedGroupMembers.has(person.id);cb.addEventListener("change",()=>{if(cb.checked)selectedGroupMembers.add(person.id);else selectedGroupMembers.delete(person.id);});label.append(cb,document.createTextNode(displayName(person)));item.append(label);groupPeopleList.append(item);}
}
function openNewChat(){newChatReturnFocus=newChatButton;newChatPanel.hidden=false;privateChatView.hidden=true;groupChatView.hidden=true;newPrivateChatButton.hidden=false;newGroupChatButton.hidden=false;closeNewChatButton.focus();}
function closeNewChat(){newChatPanel.hidden=true;if(newChatReturnFocus?.isConnected)newChatReturnFocus.focus();}
newChatButton.addEventListener("click",openNewChat);closeNewChatButton.addEventListener("click",closeNewChat);
newChatPanel.addEventListener("keydown",e=>{if(e.key==="Escape")closeNewChat();});
newPrivateChatButton.addEventListener("click",()=>{privateChatView.hidden=false;groupChatView.hidden=true;newPrivateChatButton.hidden=true;newGroupChatButton.hidden=true;peopleSearch.value="";renderPeople();peopleSearch.focus();});
newGroupChatButton.addEventListener("click",()=>{selectedGroupMembers.clear();groupNameInput.value="";groupPeopleSearch.value="";privateChatView.hidden=true;groupChatView.hidden=false;newPrivateChatButton.hidden=true;newGroupChatButton.hidden=true;renderGroupPeople();groupNameInput.focus();});
peopleSearch.addEventListener("input",renderPeople);groupPeopleSearch.addEventListener("input",renderGroupPeople);
createGroupButton.addEventListener("click",async()=>{
 if(!currentUser)return;const ids=[...selectedGroupMembers],name=groupNameInput.value.trim();
 if(!name){announce("اكتب اسم المجموعة.","error");groupNameInput.focus();return;}
 if(ids.length<2){announce("اختر شخصين على الأقل لإنشاء مجموعة.","error");return;}
 createGroupButton.disabled=true;
 try{
  const {data:conv,error}=await supabase.from("conversations").insert({user_one:currentUser.id,user_two:ids[0],is_group:true,group_name:name}).select("id,user_one,user_two,last_message_at,is_group,group_name,created_at").single();if(error)throw error;
  const rows=[currentUser.id,...ids].map(user_id=>({conversation_id:conv.id,user_id,role:user_id===currentUser.id?"admin":"member"}));
  const {error:memberError}=await supabase.from("conversation_members").insert(rows);if(memberError)throw memberError;
  const {data:person,error:profileError}=await supabase.from("profiles").select("id,display_name,avatar_url").eq("id",ids[0]).single();if(profileError)throw profileError;
  await selectConversation(conv,person);await loadConversations();closeNewChat();announce("تم إنشاء المجموعة.","success");
 }catch(error){announce("تعذر إنشاء المجموعة: "+(error.message||"حاول مرة أخرى."),"error");}finally{createGroupButton.disabled=false;}
});

async function loadConversations() {
  const { data, error } = await supabase.from("conversations")
    .select("id,user_one,user_two,last_message_at,is_group,group_name,created_at")
    .or("user_one.eq." + currentUser.id + ",user_two.eq." + currentUser.id)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  conversations = data || [];
  const {data: memberships, error: membershipError} = await supabase.from("conversation_members").select("conversation_id").eq("user_id",currentUser.id);
  if(membershipError) throw membershipError;
  const groupIds=(memberships||[]).map(m=>m.conversation_id);
  let groupRows=[];
  if(groupIds.length){const result=await supabase.from("conversations").select("id,user_one,user_two,last_message_at,is_group,group_name,created_at").in("id",groupIds);if(result.error)throw result.error;groupRows=result.data||[];}
  conversations=[...new Map([...conversations,...groupRows].map(c=>[c.id,c])).values()].sort((a,b)=>new Date(b.last_message_at||b.created_at||0)-new Date(a.last_message_at||a.created_at||0));
  const partnerIds = conversations.filter(c=>!c.is_group).map(c => c.user_one === currentUser.id ? c.user_two : c.user_one);
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
    const person = conversation.is_group ? {id:partnerId,display_name:conversation.group_name||"مجموعة"} : (profileMap.get(partnerId) || { id: partnerId, display_name: "مستخدم مرسال" });
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-button";
    button.append(safeText("span", "conversation-person-name", displayName(person)));
    const isOnline = onlineUserIds.has(partnerId);
    if (isOnline) {
      const presence = safeText("span", "conversation-presence is-online", "متصل الآن");
      button.append(presence);
    }
    button.addEventListener("click", () => { void selectConversation(conversation, person).then(()=>{if(conversation.is_group){chatPartnerName.textContent=conversation.group_name||"مجموعة";chatPartnerPresence.textContent="مجموعة";chatPartnerAccessible.setAttribute("aria-label",chatPartnerName.textContent+", مجموعة");}}); });
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
  status.textContent = "";
  activeConversation = conversation;
  activePartner = person;
  chatPartnerName.textContent = displayName(person);
  chatPartnerAccessible.setAttribute("aria-label", `${chatPartnerName.textContent}، جاري تحديث حالة الظهور`);
  const { data: partnerProfile } = await supabase.from("profiles")
    .select("last_seen_at").eq("id", person.id).maybeSingle();
  activePartnerLastSeenAt = partnerProfile?.last_seen_at || null;
  updateChatPartnerPresence();
  chatEmpty.hidden = true;
  chatView.hidden = false;
  workspace.classList.add("chat-open");
  document.body.classList.add("chat-fullscreen");
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  await loadMessages();
  await updateConversationInfo();
  await markConversationNotificationsRead(conversation.id);
  if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel("messages-" + conversation.id)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "messages",
      filter: "conversation_id=eq." + conversation.id
    }, async (payload) => {
      const { data: hidden } = await supabase.from("message_hidden_for").select("message_id")
        .eq("message_id", payload.new.id).eq("user_id", currentUser.id).maybeSingle();
      if (!hidden) appendMessage(payload.new);
    })
    .on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "messages",
      filter: "conversation_id=eq." + conversation.id
    }, () => { void loadMessages(); })
    .subscribe((state) => {
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        announce("الاتصال المباشر بالرسائل غير مستقر. استخدم زر تحديث الرسائل للمزامنة.", "error");
      }
    });
  messageInput.focus();
}

function setConversationInfoValue(element, value) {
  element.textContent = value;
  const group = element.parentElement;
  const label = group?.querySelector(".conversation-info-label")?.textContent?.trim();
  if (group && label) group.setAttribute("aria-label", label + "، " + value);
}

async function updateConversationInfo() {
  if (!activeConversation || !activePartner) return;
  const isGroup = Boolean(activeConversation.is_group), isAdmin = isGroup && activeConversation.user_one === currentUser.id;
  conversationInfoNameLabel.textContent = isGroup ? "اسم المجموعة" : "اسم الشخص";
  conversationInfoStatusRow.hidden = isGroup;
  setConversationInfoValue(conversationInfoName, isGroup ? (activeConversation.group_name || "مجموعة") : displayName(activePartner));
  if (!isGroup) setConversationInfoValue(conversationInfoStatus, onlineUserIds.has(activePartner.id) ? "متصل الآن" : formatLastSeen(activePartnerLastSeenAt));
  const createdAt = activeConversation.created_at;
  setConversationInfoValue(conversationInfoCreated, createdAt ? new Date(createdAt).toLocaleString("ar-JO", { dateStyle: "long", timeStyle: "short" }) : "غير متوفر");
  setConversationInfoValue(conversationInfoCount, "جارٍ التحميل…");
  conversationSearchArea.hidden = true; conversationSearchInput.value = ""; conversationSearchResults.replaceChildren();
  conversationSearchStatus.textContent = "اكتب كلمة لعرض النتائج.";
  groupAdminTools.hidden = !isAdmin; groupLeaveButton.hidden = !isGroup || isAdmin;
  groupMemberList.replaceChildren(); groupAddPeople.replaceChildren(); groupAddSearch.value = "";
  selectedAdditionalMembers.clear(); groupRenameInput.value = activeConversation.group_name || "";
  const [{count,error},{data:preference,error:preferenceError}] = await Promise.all([
    supabase.from("messages").select("id",{count:"exact",head:true}).eq("conversation_id",activeConversation.id),
    supabase.from("conversation_preferences").select("muted").eq("conversation_id",activeConversation.id).eq("user_id",currentUser.id).maybeSingle()
  ]);
  if(error)setConversationInfoValue(conversationInfoCount,"تعذر تحميل العدد");
  else setConversationInfoValue(conversationInfoCount,new Intl.NumberFormat("ar-JO").format(count||0));
  if(preferenceError){activeConversationMuted=false;announce("تعذر تحميل إعداد الإشعارات لهذه المحادثة.","error");}
  else activeConversationMuted=Boolean(preference?.muted);
  conversationInfoMuteButton.textContent=activeConversationMuted?"تشغيل إشعارات المحادثة":"كتم إشعارات المحادثة";
  if(isAdmin)await loadGroupManagement();
}
async function loadGroupManagement(){
  if(!activeConversation?.is_group||activeConversation.user_one!==currentUser.id)return;
  const {data:members,error}=await supabase.from("conversation_members").select("user_id,role").eq("conversation_id",activeConversation.id);
  if(error){announce("تعذر تحميل أعضاء المجموعة: "+error.message,"error");return;}
  activeGroupMemberIds=new Set((members||[]).map(member=>member.user_id));
  const ids=[...activeGroupMemberIds];let profiles=[];
  if(ids.length){const result=await supabase.from("profiles").select("id,display_name").in("id",ids);if(result.error){announce("تعذر تحميل أسماء الأعضاء.","error");return;}profiles=result.data||[];}
  const profileMap=new Map(profiles.map(profile=>[profile.id,profile]));groupMemberList.replaceChildren();
  for(const member of members||[]){
    const item=document.createElement("li"),name=profileMap.get(member.user_id)?.display_name||"مستخدم مرسال";
    item.append(safeText("span","group-member-name",name+(member.user_id===currentUser.id?" (أنت)":"")));
    if(member.user_id!==currentUser.id){const remove=safeText("button","danger-button group-member-remove","إزالة العضو "+name);remove.type="button";remove.addEventListener("click",()=>{void removeGroupMember(member.user_id,name);});item.append(remove);}
    groupMemberList.append(item);
  }
  renderGroupAddPeople();
}
function renderGroupAddPeople(){
  const term=groupAddSearch.value.trim().toLocaleLowerCase();groupAddPeople.replaceChildren();
  const available=people.filter(person=>!activeGroupMemberIds.has(person.id)&&displayName(person).toLocaleLowerCase().includes(term));
  if(!available.length){groupAddPeople.append(safeText("li","empty-item","لا يوجد أشخاص متاحون للإضافة."));return;}
  for(const person of available){
    const item=document.createElement("li"),label=document.createElement("label"),checkbox=document.createElement("input");
    label.className="group-person-choice";checkbox.type="checkbox";checkbox.checked=selectedAdditionalMembers.has(person.id);
    checkbox.addEventListener("change",()=>{if(checkbox.checked)selectedAdditionalMembers.add(person.id);else selectedAdditionalMembers.delete(person.id);});
    label.append(checkbox,document.createTextNode(displayName(person)));item.append(label);groupAddPeople.append(item);
  }
}
async function removeGroupMember(userId,name){
  if(!activeConversation||activeConversation.user_one!==currentUser.id)return;
  if(!window.confirm("هل تريد إزالة "+name+" من المجموعة؟"))return;
  const {error}=await supabase.from("conversation_members").delete().eq("conversation_id",activeConversation.id).eq("user_id",userId);
  if(error){announce("تعذرت إزالة العضو: "+error.message,"error");return;}
  await loadGroupManagement();announce("تمت إزالة العضو.");
}
groupAddSearch.addEventListener("input",renderGroupAddPeople);
groupAddSelectedButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||activeConversation.user_one!==currentUser.id)return;
  const ids=[...selectedAdditionalMembers].filter(id=>!activeGroupMemberIds.has(id));
  if(!ids.length){announce("اختر شخصًا واحدًا على الأقل.","error");return;}
  groupAddSelectedButton.disabled=true;
  try{const rows=ids.map(user_id=>({conversation_id:activeConversation.id,user_id,role:"member"}));const {error}=await supabase.from("conversation_members").insert(rows);if(error)throw error;selectedAdditionalMembers.clear();await loadGroupManagement();await loadConversations();announce("تمت إضافة الأعضاء.");}
  catch(error){announce("تعذرت إضافة الأعضاء: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{groupAddSelectedButton.disabled=false;}
});
groupRenameSaveButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||activeConversation.user_one!==currentUser.id)return;
  const name=groupRenameInput.value.trim();
  if(name.length<2){announce("اسم المجموعة يجب أن يتكون من حرفين على الأقل.","error");groupRenameInput.focus();return;}
  groupRenameSaveButton.disabled=true;
  try{const {data,error}=await supabase.from("conversations").update({group_name:name}).eq("id",activeConversation.id).eq("user_one",currentUser.id).select("id").maybeSingle();if(error||!data)throw error||new Error("لا تملك صلاحية تغيير الاسم.");activeConversation.group_name=name;chatPartnerName.textContent=name;chatPartnerAccessible.setAttribute("aria-label",name+"، مجموعة");await loadConversations();await updateConversationInfo();announce("تم تغيير اسم المجموعة.");}
  catch(error){announce("تعذر تغيير اسم المجموعة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{groupRenameSaveButton.disabled=false;}
});
groupLeaveButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||activeConversation.user_one===currentUser.id)return;
  if(!window.confirm("هل تريد مغادرة هذه المجموعة؟ لن تظهر لك رسائلها بعد المغادرة."))return;
  groupLeaveButton.disabled=true;
  try{const id=activeConversation.id;const {error}=await supabase.from("conversation_members").delete().eq("conversation_id",id).eq("user_id",currentUser.id);if(error)throw error;conversationInfoPanel.hidden=true;document.body.classList.remove("conversation-info-fullscreen","chat-fullscreen");workspace.classList.remove("chat-open");chatView.hidden=true;chatEmpty.hidden=false;activeConversation=null;activePartner=null;await loadConversations();announce("غادرت المجموعة.");}
  catch(error){announce("تعذرت مغادرة المجموعة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{groupLeaveButton.disabled=false;}
});
conversationInfoMuteButton.addEventListener("click",async()=>{
  if(!activeConversation||!currentUser)return;
  conversationInfoMuteButton.disabled=true;const muted=!activeConversationMuted;
  try{const {error}=await supabase.from("conversation_preferences").upsert({conversation_id:activeConversation.id,user_id:currentUser.id,muted,updated_at:new Date().toISOString()},{onConflict:"conversation_id,user_id"});if(error)throw error;activeConversationMuted=muted;conversationInfoMuteButton.textContent=muted?"تشغيل إشعارات المحادثة":"كتم إشعارات المحادثة";announce(muted?"تم كتم إشعارات المحادثة.":"تم تشغيل إشعارات المحادثة.");}
  catch(error){announce("تعذر تغيير الإشعارات: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{conversationInfoMuteButton.disabled=false;}
});
conversationInfoClearButton.addEventListener("click",async()=>{
  if(!activeConversation||!currentUser)return;
  if(!window.confirm("سيتم إخفاء رسائل هذه المحادثة من جهازك فقط، ولن تُحذف عند الطرف الآخر. هل تريد المتابعة؟"))return;
  conversationInfoClearButton.disabled=true;
  try{
    const id=activeConversation.id;let all=[];
    for(let offset=0;;offset+=500){const {data,error}=await supabase.from("messages").select("id").eq("conversation_id",id).order("created_at",{ascending:true}).range(offset,offset+499);if(error)throw error;all=all.concat(data||[]);if(!data||data.length<500)break;}
    const {data:hidden,error:hiddenError}=await supabase.from("message_hidden_for").select("message_id").eq("user_id",currentUser.id);if(hiddenError)throw hiddenError;
    const hiddenIds=new Set((hidden||[]).map(row=>row.message_id)),rows=all.filter(message=>!hiddenIds.has(message.id)).map(message=>({message_id:message.id,user_id:currentUser.id}));
    for(let i=0;i<rows.length;i+=100){const {error}=await supabase.from("message_hidden_for").insert(rows.slice(i,i+100));if(error)throw error;}
    await loadMessages();conversationInfoPanel.hidden=true;document.body.classList.remove("conversation-info-fullscreen");announce("تم مسح المحادثة من جهازك.");
  }catch(error){announce("تعذر مسح المحادثة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{conversationInfoClearButton.disabled=false;}
});
conversationInfoSearchButton.addEventListener("click", () => {
  conversationSearchArea.hidden = false;
  conversationSearchInput.focus();
});
conversationSearchInput.addEventListener("input", () => {
  const term = conversationSearchInput.value.trim().toLocaleLowerCase();
  conversationSearchResults.replaceChildren();
  if (!term) {
    conversationSearchStatus.textContent = "اكتب كلمة لعرض النتائج.";
    return;
  }
  const matches = [...messagesList.querySelectorAll(".message")].filter(item => {
    const text = [...item.querySelectorAll(".message-body, .attachment-file-name")]
      .map(node => node.textContent || "").join(" ").toLocaleLowerCase();
    return text.includes(term);
  });
  conversationSearchStatus.textContent = matches.length
    ? "عدد النتائج: " + new Intl.NumberFormat("ar-JO").format(matches.length)
    : "لا توجد نتائج ضمن الرسائل المحمّلة حاليًا.";
  for (const item of matches) {
    const messageText = [...item.querySelectorAll(".message-body, .attachment-file-name")]
      .map(node => node.textContent || "").join(" ").trim() || "مرفق";
    const time = item.querySelector(".message-time")?.textContent || "";
    const result = document.createElement("li");
    const button = safeText("button", "conversation-search-result", messageText.slice(0, 180) + (time ? "، " + time : ""));
    button.type = "button";
    button.addEventListener("click", () => {
      conversationInfoPanel.hidden = true;
      document.body.classList.remove("conversation-info-fullscreen");
      item.tabIndex = -1;
      item.scrollIntoView({ behavior: "smooth", block: "center" });
      item.focus();
    });
    result.append(button);
    conversationSearchResults.append(result);
  }
});
conversationInfoExportButton.addEventListener("click", async () => {
  if (!activeConversation || !currentUser) return;
  conversationInfoExportButton.disabled = true;
  try {
    const { data, error } = await supabase.from("messages")
      .select("id,sender_id,body,created_at,is_deleted")
      .eq("conversation_id", activeConversation.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const rows = data || [];
    const { data: hiddenRows, error: hiddenError } = await supabase.from("message_hidden_for")
      .select("message_id").eq("user_id", currentUser.id);
    if (hiddenError) throw hiddenError;
    const hiddenIds = new Set((hiddenRows || []).map(row => row.message_id));
    const visible = rows.filter(row => !hiddenIds.has(row.id));
    const senderIds = [...new Set(visible.map(row => row.sender_id).filter(Boolean))];
    let names = new Map();
    if (senderIds.length) {
      const { data: profiles, error: profileError } = await supabase.from("profiles")
        .select("id,display_name").in("id", senderIds);
      if (profileError) throw profileError;
      names = new Map((profiles || []).map(profile => [profile.id, profile.display_name || "مستخدم مرسال"]));
    }
    const title = activeConversation.is_group
      ? (activeConversation.group_name || "مجموعة")
      : displayName(activePartner);
    const lines = ["مرسال - " + title, "آخر " + visible.length + " رسالة", ""];
    for (const message of visible) {
      const date = new Date(message.created_at).toLocaleString("ar-JO");
      let body = message.is_deleted ? "تم حذف هذه الرسالة." : (message.body || "");
      const marker = "MERSAL_ATTACHMENT:";
      const markerIndex = body.indexOf(marker);
      if (markerIndex >= 0) {
        try {
          const attachment = JSON.parse(body.slice(markerIndex + marker.length));
          body = "[مرفق: " + (attachment.name || "ملف") + "]";
        } catch { body = "[مرفق]"; }
      }
      const sender = message.sender_id === currentUser.id ? "أنت" : (names.get(message.sender_id) || "مستخدم مرسال");
      lines.push(date + " — " + sender + ": " + body);
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mersal-conversation-" + new Date().toISOString().slice(0, 10) + ".txt";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    announce("تم تجهيز سجل المحادثة.");
  } catch (error) {
    announce("تعذر تجهيز سجل المحادثة: " + (error.message || "حاول مرة أخرى."), "error");
  } finally {
    conversationInfoExportButton.disabled = false;
  }
});
backToChatsButton.addEventListener("click", () => {
  document.body.classList.remove("chat-fullscreen");
  workspace.classList.remove("chat-open");
  chatView.hidden = true;
  chatEmpty.hidden = false;
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  peopleSearch.focus();
});
conversationInfoToggle.addEventListener("click", async () => {
  const opening = conversationInfoPanel.hidden;
  if (opening) status.textContent = "";
  conversationInfoPanel.hidden = !opening;
  document.body.classList.toggle("conversation-info-fullscreen", opening);
  if (opening) {
    await updateConversationInfo();
    closeConversationInfoButton.focus();
  }
});
closeConversationInfoButton.addEventListener("click", () => {
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  conversationInfoToggle.focus();
});

function closeMessageOptions(menu, toggle) {
  menu.classList.remove("is-open");
  menu.hidden = true;
  menu.removeAttribute("role");
  menu.removeAttribute("aria-modal");
  if (menu._home && menu.parentElement !== menu._home) menu._home.append(menu);
  toggle.setAttribute("aria-expanded", "false");
  toggle.focus();
}
async function deleteMessageForMe(message, item, menu, toggle) {
  if (!currentUser || !activeConversation) return;
  if (!window.confirm("هل تريد حذف هذه الرسالة من محادثتك فقط؟")) return;
  const { error } = await supabase.from("message_hidden_for").insert({
    message_id: message.id, user_id: currentUser.id
  });
  if (error && error.code !== "23505") {
    announce("تعذر حذف الرسالة لديك: " + error.message, "error");
    return;
  }
  item.remove();
  closeMessageOptions(menu, toggle);
  if (!messagesList.querySelector(".message")) messagesList.append(safeText("li", "empty-item", "هذه بداية المحادثة. أرسل أول رسالة."));
  announce("تم الحذف.", "success");
}
async function deleteMessageForEveryone(message, item, menu, toggle) {
  if (!currentUser || message.sender_id !== currentUser.id) {
    announce("يمكنك حذف رسائلك أنت لدى الجميع فقط.", "error");
    return;
  }
  if (!window.confirm("سيتم حذف محتوى الرسالة من محادثتك ومحادثة الطرف الآخر. هل تريد المتابعة؟")) return;
  const { data, error } = await supabase.from("messages")
    .update({ is_deleted: true }).eq("id", message.id).eq("sender_id", currentUser.id)
    .select("id").maybeSingle();
  if (error || !data) {
    announce("تعذر حذف الرسالة لدى الجميع: " + (error?.message || "لم يتم تحديث الرسالة."), "error");
    return;
  }
  item.replaceChildren(safeText("p", "message-body deleted-message", "تم حذف هذه الرسالة."));
  item.classList.add("message-deleted");
  closeMessageOptions(menu, toggle);
  announce("تم الحذف.", "success");
}
function appendMessage(message) {
  if (!message || document.querySelector('[data-message-id="' + message.id + '"]')) return;
  messagesList.querySelectorAll(".empty-item").forEach(node => node.remove());
  const item = document.createElement("li");
  item.className = message.sender_id === currentUser.id ? "message mine" : "message theirs";
  item.dataset.messageId = message.id;
  if (message.is_deleted) {
    item.classList.add("message-deleted");
    item.append(safeText("p", "message-body deleted-message", "تم حذف هذه الرسالة."));
    messagesList.append(item);
    messagesList.scrollTop = messagesList.scrollHeight;
    return;
  }
  const attachmentPrefix = "MERSAL_ATTACHMENT:";
  const attachmentIndex = (message.body || "").indexOf(attachmentPrefix);
  let attachment = null;
  if (attachmentIndex >= 0) {
    try { attachment = JSON.parse(message.body.slice(attachmentIndex + attachmentPrefix.length)); } catch { attachment = null; }
  }
  if (attachment?.path) {
    const attachmentView = document.createElement("div");
    attachmentView.className = "message-attachment";
    const fileName = attachment.name || "ملف مرفق";
    const fileInfo = safeText("p", "attachment-file-name", "📎 " + fileName);
    attachmentView.append(fileInfo);
    void supabase.storage.from("mersal-attachments").createSignedUrl(attachment.path, 3600).then(({ data, error }) => {
      if (error || !data?.signedUrl) {
        attachmentView.append(safeText("p", "attachment-unavailable", "تعذر فتح المرفق."));
        return;
      }
      const previewButton = safeText("button", "attachment-open-button", attachment.type?.startsWith("image/") ? "عرض الصورة داخل المحادثة" : attachment.type?.startsWith("video/") ? "تشغيل الفيديو داخل المحادثة" : "عرض الملف داخل المحادثة");
      previewButton.type = "button";
      previewButton.setAttribute("aria-label", (attachment.type?.startsWith("image/") ? "عرض الصورة " : attachment.type?.startsWith("video/") ? "تشغيل الفيديو " : "عرض الملف ") + fileName + " داخل المحادثة");
      previewButton.addEventListener("click", () => openAttachmentViewer(data.signedUrl, attachment.type || "", fileName, previewButton));
      if (attachment.type?.startsWith("image/")) {
        const preview = document.createElement("img");
        preview.src = data.signedUrl; preview.alt = "صورة مرفقة: " + fileName;
        preview.loading = "lazy"; preview.className = "attachment-image";
        previewButton.prepend(preview);
      } else {
        previewButton.prepend(safeText("span", "attachment-preview-icon", attachment.type?.startsWith("video/") ? "▶" : "📄"));
      }
      attachmentView.insertBefore(previewButton, fileInfo);
    }).catch(() => attachmentView.append(safeText("p", "attachment-unavailable", "تعذر فتح المرفق.")));
    item.append(attachmentView);
  } else {
    item.append(safeText("p", "message-body", message.body));
  }
  const time = new Date(message.created_at).toLocaleString("ar-JO", { dateStyle: "short", timeStyle: "short" });
  item.append(safeText("time", "message-time", time));
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const toggle = safeText("button", "message-options-toggle", "خيارات الرسالة");
  toggle.type = "button";
  toggle.setAttribute("aria-haspopup", "dialog");
  toggle.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "message-options";
  menu.hidden = true;
  menu._home = actions;
  const menuTitle = safeText("div", "message-options-title", "خيارات الرسالة");
  menuTitle.id = "message-options-title-" + message.id;
  const closeButton = safeText("button", "message-option-button message-options-close", "إغلاق الخيارات");
  closeButton.type = "button";
  closeButton.addEventListener("click", () => closeMessageOptions(menu, toggle));
  toggle.addEventListener("click", () => {
    menu.hidden = false;
    menu.classList.add("is-open");
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-modal", "true");
    menu.setAttribute("aria-labelledby", menuTitle.id);
    toggle.setAttribute("aria-expanded", "true");
    document.body.append(menu);
    closeButton.focus();
  });
  const copyButton = safeText("button", "message-option-button", "نسخ الرسالة");
  copyButton.type = "button";
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.body || "");
      announce("تم نسخ الرسالة.");
    } catch {
      announce("تعذر نسخ الرسالة من هذا المتصفح.", "error");
    }
    closeMessageOptions(menu, toggle);
  });
  const replyButton = safeText("button", "message-option-button", "الرد على الرسالة");
  replyButton.type = "button";
  replyButton.addEventListener("click", () => {
    replyingToMessage = { id: message.id, body: message.body || "" };
    replyingToText.textContent = "الرد على: " + (message.body || "");
    replyingTo.hidden = false;
    closeMessageOptions(menu, toggle);
    messageInput.focus();
    announce("اكتب ردك على الرسالة المحددة.");
  });
  const deleteMineButton = safeText("button", "message-option-button message-delete-button", "حذف لدي");
  deleteMineButton.type = "button";
  deleteMineButton.addEventListener("click", () => { void deleteMessageForMe(message, item, menu, toggle); });
  const deleteEveryoneButton = safeText("button", "message-option-button message-delete-everyone-button", "حذف لدى الجميع");
  deleteEveryoneButton.type = "button";
  deleteEveryoneButton.disabled = message.sender_id !== currentUser.id;
  deleteEveryoneButton.setAttribute("aria-label", message.sender_id === currentUser.id ? "حذف هذه الرسالة لدى الجميع" : "حذف لدى الجميع، متاح لرسائلك أنت فقط");
  deleteEveryoneButton.addEventListener("click", () => { void deleteMessageForEveryone(message, item, menu, toggle); });
  menu.append(menuTitle, closeButton, copyButton, replyButton, deleteMineButton, deleteEveryoneButton);
  actions.append(toggle, menu);
  item.append(actions);
  messagesList.append(item);
  messagesList.scrollTop = messagesList.scrollHeight;
}
async function loadMessages() {
  if (!activeConversation) return;
  messagesList.replaceChildren();
  const { data, error } = await supabase.from("messages")
    .select("id,conversation_id,sender_id,body,created_at,is_deleted")
    .eq("conversation_id", activeConversation.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    announce("تعذر تحميل الرسائل: " + error.message, "error");
    return;
  }
  const { data: hiddenRows, error: hiddenError } = await supabase.from("message_hidden_for")
    .select("message_id").eq("user_id", currentUser.id);
  if (hiddenError) {
    announce("تعذر تحميل إعدادات إخفاء الرسائل: " + hiddenError.message, "error");
    return;
  }
  const hiddenIds = new Set((hiddenRows || []).map(row => row.message_id));
  const visibleMessages = (data || []).filter(message => !hiddenIds.has(message.id));
  if (!visibleMessages.length) messagesList.append(safeText("li", "empty-item", "هذه بداية المحادثة. أرسل أول رسالة."));
  for (const message of visibleMessages) appendMessage(message);
}
cancelReplyButton.addEventListener("click", () => { replyingToMessage = null; replyingTo.hidden = true; messageInput.focus(); });
$("#refresh-chat").addEventListener("click", () => { void loadMessages(); });

function closeAttachmentChooser() {
  attachmentChooser.hidden = true;
  attachButton.focus();
}
attachButton.addEventListener("click", () => {
  attachmentChooser.hidden = false;
  closeAttachmentChooserButton.focus();
});
closeAttachmentChooserButton.addEventListener("click", closeAttachmentChooser);
attachmentChooser.addEventListener("keydown", event => {
  if (event.key === "Escape") closeAttachmentChooser();
});
$("#choose-images").addEventListener("click", () => imageFileInput.click());
$("#choose-videos").addEventListener("click", () => videoFileInput.click());
$("#choose-files").addEventListener("click", () => documentFileInput.click());

async function uploadAttachments(fileList) {
  const files = [...(fileList || [])];
  if (!files.length || !currentUser || !activeConversation) return;
  closeAttachmentChooser();
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024) {
      announce("حجم الملف " + file.name + " أكبر من 50 ميغابايت.", "error");
      continue;
    }
    sendButton.disabled = true;
    attachButton.disabled = true;
    announce("جارٍ رفع " + file.name + "…");
    try {
      // Use an ASCII-only storage object key. Keep the original filename only as message metadata.
      const extensionMatch = String(file.name || "").match(/\.([a-zA-Z0-9]{1,10})$/);
      const safeExtension = extensionMatch ? "." + extensionMatch[1].toLowerCase() : "";
      const unique = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2));
      const path = activeConversation.id + "/" + currentUser.id + "/" + unique + safeExtension;
      const { data: uploaded, error: uploadError } = await supabase.storage.from("mersal-attachments").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });
      if (uploadError) throw uploadError;
      const attachment = { path: uploaded.path, name: file.name, type: file.type || "application/octet-stream", size: file.size };
      const body = "📎 " + file.name + "\\nMERSAL_ATTACHMENT:" + JSON.stringify(attachment);
      const { data, error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id, sender_id: currentUser.id, body
      }).select("id,conversation_id,sender_id,body,created_at").single();
      if (error) {
        await supabase.storage.from("mersal-attachments").remove([uploaded.path]);
        throw error;
      }
      appendMessage(data);
      await loadConversations();
      const { error: pushError } = await supabase.functions.invoke("send-push", { body: { message_id: data.id } });
      if (pushError) console.warn("Push notification could not be sent:", pushError.message);
      announce("تم الإرسال.", "success");
    } catch (error) {
      announce("تعذر إرسال الملف " + file.name + ": " + (error.message || "حاول مرة أخرى."), "error");
    } finally {
      sendButton.disabled = false;
      attachButton.disabled = false;
    }
  }
}
for (const input of [imageFileInput, videoFileInput, documentFileInput]) {
  input.addEventListener("change", () => {
    void uploadAttachments(input.files);
    input.value = "";
  });
}

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typedBody = messageInput.value.trim();
  if (!typedBody) {
    announce("اكتب رسالتك قبل الإرسال.");
    return;
  }
  if (!activeConversation || !currentUser) return;
  const body = replyingToMessage ? "ردًا على: " + replyingToMessage.body + "\n\n" + typedBody : typedBody;
  sendButton.disabled = true;
  const { data, error } = await supabase.from("messages").insert({
    conversation_id: activeConversation.id, sender_id: currentUser.id, body
  }).select("id,conversation_id,sender_id,body,created_at").single();
  if (error) {
    announce("تعذر إرسال الرسالة: " + error.message, "error");
  } else {
    messageInput.value = "";
    replyingToMessage = null;
    replyingTo.hidden = true;
    appendMessage(data);
    await loadConversations();
    const { error: pushError } = await supabase.functions.invoke("send-push", { body: { message_id: data.id } });
    if (pushError) console.warn("Push notification could not be sent:", pushError.message);
    announce("تم الإرسال.", "success");
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
