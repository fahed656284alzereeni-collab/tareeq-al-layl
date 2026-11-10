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
const startupRetryButton = $("#startup-retry");
function finishStartup() {
  if (window.__mersalStartupTimer) window.clearTimeout(window.__mersalStartupTimer);
  if (startupRetryButton) startupRetryButton.hidden = true;
}
const loginButton = $("#google-login");
const bottomNavigation = $("#bottom-navigation");
const homeTabButton = $("#home-tab");
const settingsTabButton = $("#settings-tab");
const statusTabButton = $("#status-tab");
const statusView = $("#status-view");
const statusList = $("#status-list");
const statusComposerPanel = $("#status-composer-panel");
const statusViewerPanel = $("#status-viewer-panel");
const statusTextInput = $("#status-text-input");
const statusImageInput = $("#status-image-input");
const statusVideoInput = $("#status-video-input");
const settingsPanel = $("#settings-panel");
const settingsForm = $("#settings-form");
const displayNameInput = $("#settings-display-name");
const textSizeSelect = $("#settings-text-size");
const themeSelect = $("#settings-theme");
const settingsEmail = $("#settings-email");
const settingsHome = $("#settings-home");
const accountSettingsView = $("#account-settings-view");
const accountLogoutButton = $("#account-logout-button");
const deleteAccountButton = $("#delete-account-button");
const deleteAccountPanel = $("#delete-account-panel");
const closeDeleteAccountButton = $("#close-delete-account");
const cancelDeleteAccountButton = $("#cancel-delete-account");
const deleteAccountConfirmation = $("#delete-account-confirmation");
const confirmDeleteAccountButton = $("#confirm-delete-account");
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

function setActiveBottomTab(tab) {
  if (!homeTabButton || !settingsTabButton || !statusTabButton) return;
  homeTabButton.setAttribute("aria-selected", String(tab === "home"));
  statusTabButton.setAttribute("aria-selected", String(tab === "statuses"));
  settingsTabButton.setAttribute("aria-selected", String(tab === "settings"));
}
function returnToHomeTab() {
  if (settingsPanel && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    document.body.classList.remove("settings-open");
  }
  statusView.hidden = true;
  document.body.classList.remove("status-open");
  setActiveBottomTab("home");
  if (document.body.classList.contains("chat-fullscreen")) backToChatsButton.click();
}
function openStatusTab() {
  if (!currentUser) return;
  if (settingsPanel && !settingsPanel.hidden) {
    settingsPanel.hidden = true;
    document.body.classList.remove("settings-open");
  }
  if (document.body.classList.contains("chat-fullscreen")) backToChatsButton.click();
  statusView.hidden = false;
  document.body.classList.add("status-open");
  setActiveBottomTab("statuses");
  void loadStatuses().catch(error => announce("تعذر تحميل الحالات: " + error.message, "error"));
}

const markAllReadButton = $("#mark-all-read");
const chatEmpty = $("#chat-empty");
const chatView = $("#chat-view");
const backToChatsButton = $("#back-to-chats");
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
const blockPersonButton = $("#block-person-button");
const conversationDeleteButton = $("#conversation-delete-button");
const groupAddMembersButton = $("#group-add-members-button");
const groupAddPanel = $("#group-add-panel");
const closeGroupAddButton = $("#close-group-add");
const groupAdminTools = $("#group-admin-tools");
const groupRenameInput = $("#group-rename-input");
const groupRenameSaveButton = $("#group-rename-save");
const groupAddSearch = $("#group-add-search");
const groupAddPeople = $("#group-add-people");
const groupAddSelectedButton = $("#group-add-selected");
const groupMemberList = $("#group-member-list");
const groupMemberOptionsPanel = $("#group-member-options-panel");
const closeGroupMemberOptionsButton = $("#close-group-member-options");
const groupMemberOptionsName = $("#group-member-options-name");
const groupMemberOptionsRole = $("#group-member-options-role");
const groupMemberOptionsActions = $("#group-member-options-actions");
let groupMemberOptionsReturnFocus = null;
const groupLeaveButton = $("#group-leave");
const groupDeleteEveryoneButton = $("#group-delete-everyone");
const voiceCallButton = $("#voice-call-button");
const voiceCallPanel = $("#voice-call-panel");
const voiceCallStatus = $("#voice-call-status");
const voiceCallParticipants = $("#voice-call-participants");
const voiceCallAudio = $("#voice-call-audio");
const voiceCallAcceptButton = $("#voice-call-accept");
const voiceCallRejectButton = $("#voice-call-reject");
const voiceCallMuteButton = $("#voice-call-mute");
const voiceCallEndButton = $("#voice-call-end");
let callChannel = null, callChannelConversationId = null, callChannelReady = false, callChannelPromise = null;
let activeCall = null;
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
let activeBlockState = { blockedByMe: false, blockedByThem: false };
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
  finishStartup();
  settingsPanel.hidden = true;
  document.body.classList.remove("settings-open");
  bottomNavigation.hidden = true;
  statusView.hidden = true;
  statusComposerPanel.hidden = true;
  statusViewerPanel.hidden = true;
  if (statusExpiryTimer) clearTimeout(statusExpiryTimer);
  statusExpiryTimer = null;
  document.body.classList.remove("status-open");
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
  void endVoiceCall(false);
  void closeCallChannel();
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
  authPanel.hidden = true;
  workspace.hidden = false;
  bottomNavigation.hidden = false;
  setActiveBottomTab("home");
  account.textContent = "مرحبًا بك في مرسال · متصل الآن";

  // Reveal the usable app immediately; load account data and live updates in the background.
  finishStartup();
  if (status.textContent === "جارٍ تجهيز مرسال…") status.textContent = "";

  void syncPushNotificationState();
  void loadStatuses().catch(error => announce("تعذر تحميل الحالات: " + (error.message || "حاول مرة أخرى."), "error"));
  void touchLastSeen();
  if (!lastSeenHeartbeat) lastSeenHeartbeat = window.setInterval(() => { if (document.visibilityState === "visible") void touchLastSeen(); }, 60000);

  try {
    if (!alreadyLoadedForThisUser) {
      await ensureProfile(session.user);
      await Promise.all([loadPeople(), loadConversations(), loadNotifications(), loadOwnProfile()]);
    }
    await startPresence();
    startNotificationsRealtime();
    if (!alreadyLoadedForThisUser && authEvent !== "TOKEN_REFRESHED") {
      announce("تم تسجيل الدخول. يمكنك بدء محادثة جديدة.");
    }
  } catch (error) {
    finishStartup();
    announce("تعذر تحميل بعض بيانات الحساب: " + (error.message || "خطأ غير معروف"), "error");
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
  if (activeConversation?.is_group) {
    chatPartnerPresence.textContent = "مجموعة";
    chatPartnerPresence.classList.remove("is-online", "is-offline");
    chatPartnerAccessible.setAttribute("aria-label", `${chatPartnerName.textContent}، مجموعة`);
    return;
  }
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
    .select("id,user_one,user_two,created_at,last_message_at,is_group,group_name")
    .eq("id", notification.conversation_id).single();
  if (error) {
    announce("تعذر فتح المحادثة من الإشعار: " + error.message, "error");
    return;
  }
  await selectConversation(conversation, sender);
  if (conversation.is_group) {
    chatPartnerName.textContent = conversation.group_name || "مجموعة";
    chatPartnerPresence.textContent = "مجموعة";
    chatPartnerAccessible.setAttribute("aria-label", chatPartnerName.textContent + "، مجموعة");
  }
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
  statusView.hidden = true;
  document.body.classList.remove("status-open");
  settingsReturnFocus = document.activeElement;
  settingsEmail.value = currentUser.email || "";
  textSizeSelect.value = localStorage.getItem("mersal-text-size") || "normal";
  themeSelect.value = localStorage.getItem("mersal-theme") || "system";
  applyTextSize(textSizeSelect.value);
  applyTheme(themeSelect.value);
  settingsHome.hidden = false;
  accountSettingsView.hidden = true;
  settingsPanel.hidden = false;
  document.body.classList.add("settings-open");
  setActiveBottomTab("settings");
  $("#open-account-settings").focus();
}
async function loadOwnProfile() {
  const { data, error } = await supabase.from("profiles")
    .select("display_name").eq("id", currentUser.id).maybeSingle();
  if (error) throw error;
  displayNameInput.value = data?.display_name || currentUser.email?.split("@")[0] || "";
}
settingsTabButton.addEventListener("click", openSettings);
statusTabButton.addEventListener("click", openStatusTab);
homeTabButton.addEventListener("click", returnToHomeTab);
$("#open-account-settings").addEventListener("click", () => { settingsHome.hidden = true; accountSettingsView.hidden = false; displayNameInput.focus(); });
$("#back-settings-home").addEventListener("click", () => { accountSettingsView.hidden = true; settingsHome.hidden = false; $("#open-account-settings").focus(); });
accountLogoutButton.addEventListener("click", async () => {
  accountLogoutButton.disabled = true;
  const { error } = await supabase.auth.signOut({ scope: "local" });
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
    document.body.classList.remove("settings-open");
    setActiveBottomTab("home");
    settingsReturnFocus?.focus?.();
  }
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
    document.body.classList.remove("settings-open");
    setActiveBottomTab("home");
    settingsReturnFocus?.focus?.();
  }
  saveButton.disabled = false;
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
 if(ids.length<1){announce("اختر شخصًا واحدًا على الأقل لإنشاء المجموعة.","error");return;}
 createGroupButton.disabled=true;
 try{
  const {data:conv,error}=await supabase.from("conversations").insert({user_one:currentUser.id,user_two:ids[0],is_group:true,group_name:name}).select("id,user_one,user_two,last_message_at,is_group,group_name,created_at").single();if(error)throw error;
  const rows=[currentUser.id,...ids].map(user_id=>({conversation_id:conv.id,user_id,role:user_id===currentUser.id?"admin":"member"}));
  const {error:memberError}=await supabase.from("conversation_members").insert(rows);if(memberError)throw memberError;
  const {data:person,error:profileError}=await supabase.from("profiles").select("id,display_name,avatar_url").eq("id",ids[0]).single();if(profileError)throw profileError;
  await selectConversation(conv,{...person,display_name:name});await loadConversations();closeNewChat();announce("تم إنشاء المجموعة.","success");
 }catch(error){announce("تعذر إنشاء المجموعة: "+(error.message||"حاول مرة أخرى."),"error");}finally{createGroupButton.disabled=false;}
});


let selectedStatusKind = "text";
let selectedStatusFile = null;
let statusExpiryTimer = null;
let statusViewerReturnFocus = null;
let activeViewedStatus = null;
function statusKindLabel(kind) { return kind === "image" ? "صورة" : kind === "video" ? "فيديو" : "نص"; }
function statusTimeLabel(value) {
  return new Date(value).toLocaleString("ar-JO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
async function loadStatuses() {
  if (!currentUser || !statusList) return;
  if (statusExpiryTimer) clearTimeout(statusExpiryTimer);
  const { data, error } = await supabase.from("statuses")
    .select("id,user_id,kind,content,media_path,media_type,created_at,expires_at")
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const nextExpiry = rows.reduce((nearest, row) => Math.min(nearest, new Date(row.expires_at).getTime()), Infinity);
  if (Number.isFinite(nextExpiry)) {
    statusExpiryTimer = setTimeout(() => {
      void loadStatuses().catch(error => announce("تعذر تحديث الحالات: " + error.message, "error"));
    }, Math.max(1000, nextExpiry - Date.now() + 1000));
  }
  const ids = [...new Set(rows.map(row => row.user_id))];
  let profiles = new Map();
  if (ids.length) {
    const result = await supabase.from("profiles").select("id,display_name").in("id", ids);
    if (result.error) throw result.error;
    profiles = new Map((result.data || []).map(profile => [profile.id, profile]));
  }
  statusList.replaceChildren();
  if (!rows.length) { statusList.append(safeText("li", "empty-item", "لا توجد حالات حاليًا.")); return; }
  for (const row of rows) {
    const own = row.user_id === currentUser.id;
    const name = own ? "حالتي" : displayName(profiles.get(row.user_id));
    const button = safeText("button", "status-entry", name + "، " + statusKindLabel(row.kind) + "، " + statusTimeLabel(row.created_at));
    button.type = "button";
    button.addEventListener("click", () => { void openStatusViewer(row, name, button); });
    const item = document.createElement("li"); item.append(button); statusList.append(item);
  }
}
function openStatusComposer() {
  selectedStatusKind = "text"; selectedStatusFile = null;
  statusTextInput.value = ""; statusImageInput.value = ""; statusVideoInput.value = "";
  $("#status-selected-media").textContent = "";
  $("#status-text-mode").setAttribute("aria-pressed", "true");
  $("#status-image-mode").setAttribute("aria-pressed", "false");
  $("#status-video-mode").setAttribute("aria-pressed", "false");
  statusTextInput.placeholder = "اكتب حالتك";
  statusComposerPanel.hidden = false; $("#close-status-composer").focus();
}
function closeStatusComposer() { statusComposerPanel.hidden = true; $("#add-status-button").focus(); }
function setStatusKind(kind) {
  selectedStatusKind = kind; selectedStatusFile = null;
  statusImageInput.value = ""; statusVideoInput.value = "";
  $("#status-selected-media").textContent = "";
  $("#status-text-mode").setAttribute("aria-pressed", String(kind === "text"));
  $("#status-image-mode").setAttribute("aria-pressed", String(kind === "image"));
  $("#status-video-mode").setAttribute("aria-pressed", String(kind === "video"));
  statusTextInput.placeholder = kind === "text" ? "اكتب حالتك" : "أضف وصفًا اختياريًا";
  if (kind === "image") statusImageInput.click();
  if (kind === "video") statusVideoInput.click();
}
$("#add-status-button").addEventListener("click", openStatusComposer);
$("#refresh-statuses-button").addEventListener("click", () => {
  const button = $("#refresh-statuses-button"); button.disabled = true;
  void loadStatuses().then(() => announce("تم تحديث الحالات."))
    .catch(error => announce("تعذر تحديث الحالات: " + error.message, "error"))
    .finally(() => { button.disabled = false; });
});
$("#close-status-composer").addEventListener("click", closeStatusComposer);
$("#status-text-mode").addEventListener("click", () => setStatusKind("text"));
$("#status-image-mode").addEventListener("click", () => setStatusKind("image"));
$("#status-video-mode").addEventListener("click", () => setStatusKind("video"));
statusImageInput.addEventListener("change", () => {
  selectedStatusFile = statusImageInput.files?.[0] || null;
  $("#status-selected-media").textContent = selectedStatusFile ? selectedStatusFile.name : "";
});
statusVideoInput.addEventListener("change", () => {
  selectedStatusFile = statusVideoInput.files?.[0] || null;
  $("#status-selected-media").textContent = selectedStatusFile ? selectedStatusFile.name : "";
});
$("#publish-status-button").addEventListener("click", async () => {
  if (!currentUser) return;
  const content = statusTextInput.value.trim();
  if (selectedStatusKind === "text" && !content) { announce("اكتب نص الحالة أولًا.", "error"); statusTextInput.focus(); return; }
  if (selectedStatusKind !== "text" && !selectedStatusFile) { announce("اختر صورة أو فيديو أولًا.", "error"); return; }
  if (selectedStatusFile && selectedStatusFile.size > 50 * 1024 * 1024) { announce("حجم الملف أكبر من 50 ميغابايت.", "error"); return; }
  if (selectedStatusFile && !(selectedStatusKind === "image" ? selectedStatusFile.type.startsWith("image/") : selectedStatusFile.type.startsWith("video/"))) {
    announce("نوع الملف لا يطابق نوع الحالة المختار.", "error"); return;
  }
  const button = $("#publish-status-button"); button.disabled = true;
  let uploadedPath = null;
  try {
    let mediaType = null;
    if (selectedStatusFile) {
      mediaType = selectedStatusFile.type;
      const extension = String(selectedStatusFile.name || "").match(/\.([a-zA-Z0-9]{1,10})$/)?.[1]?.toLowerCase() || "bin";
      const unique = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2);
      uploadedPath = "statuses/" + currentUser.id + "/" + unique + "." + extension;
      const upload = await supabase.storage.from("mersal-attachments").upload(uploadedPath, selectedStatusFile, { contentType: mediaType, upsert: false });
      if (upload.error) throw upload.error;
    }
    const { error } = await supabase.from("statuses").insert({
      user_id: currentUser.id, kind: selectedStatusKind, content: content || null,
      media_path: uploadedPath, media_type: mediaType,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    if (error) throw error;
    statusComposerPanel.hidden = true;
    await loadStatuses();
    $("#add-status-button").focus();
    announce("تم نشر الحالة.");
  } catch (error) {
    if (uploadedPath) await supabase.storage.from("mersal-attachments").remove([uploadedPath]);
    announce("تعذر نشر الحالة: " + (error.message || "حاول مرة أخرى."), "error");
  } finally { button.disabled = false; }
});
async function openStatusViewer(row, name, trigger) {
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await loadStatuses();
    announce("انتهت صلاحية هذه الحالة.");
    return;
  }
  statusViewerReturnFocus = trigger; activeViewedStatus = row;
  $("#status-viewer-content").replaceChildren(); $("#status-viewer-views").replaceChildren();
  $("#status-viewer-caption").textContent = row.content || "";
  $("#status-viewer-meta").textContent = name + "، " + statusTimeLabel(row.created_at);
  const own = row.user_id === currentUser.id;
  $("#delete-status-button").hidden = !own;
  if (!own) {
    const viewed = await supabase.from("status_views").insert({ status_id: row.id, viewer_id: currentUser.id });
    if (viewed.error && viewed.error.code !== "23505") console.warn("تعذر تسجيل مشاهدة الحالة:", viewed.error.message);
  }
  if (row.kind === "text") {
    $("#status-viewer-content").append(safeText("p", "status-viewer-text", row.content || ""));
  } else if (row.media_path) {
    const remaining = Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000);
    if (remaining <= 0) {
      $("#status-viewer-content").append(safeText("p", "empty-item", "انتهت صلاحية هذه الحالة."));
    } else {
      const signed = await supabase.storage.from("mersal-attachments").createSignedUrl(row.media_path, Math.min(3600, remaining));
      if (signed.error || !signed.data?.signedUrl) {
        $("#status-viewer-content").append(safeText("p", "empty-item", "تعذر فتح الحالة."));
      } else if (row.kind === "image") {
        const media = document.createElement("img"); media.src = signed.data.signedUrl;
        media.alt = "صورة الحالة من " + name; media.className = "status-viewer-image";
        $("#status-viewer-content").append(media);
      } else {
        const media = document.createElement("video"); media.src = signed.data.signedUrl;
        media.controls = true; media.playsInline = true; media.preload = "metadata";
        media.setAttribute("aria-label", "فيديو الحالة من " + name); media.className = "status-viewer-video";
        $("#status-viewer-content").append(media);
      }
    }
  }
  if (own) {
    const result = await supabase.from("status_views").select("viewer_id,viewed_at").eq("status_id", row.id).order("viewed_at", { ascending: false });
    if (result.error) $("#status-viewer-views").append(safeText("li", "empty-item", "تعذر تحميل المشاهدات."));
    else if (!result.data?.length) $("#status-viewer-views").append(safeText("li", "empty-item", "لم يشاهدها أحد بعد."));
    else {
      const ids = [...new Set(result.data.map(view => view.viewer_id))];
      const profiles = await supabase.from("profiles").select("id,display_name").in("id", ids);
      const names = new Map((profiles.data || []).map(profile => [profile.id, profile.display_name]));
      for (const view of result.data) $("#status-viewer-views").append(safeText("li", "status-viewer-person",
        (names.get(view.viewer_id) || "مستخدم مرسال") + "، " + statusTimeLabel(view.viewed_at)));
    }
  }
  statusViewerPanel.hidden = false; $("#close-status-viewer").focus();
}
function closeStatusViewer() {
  statusViewerPanel.hidden = true; $("#status-viewer-content").replaceChildren();
  if (statusViewerReturnFocus?.isConnected) statusViewerReturnFocus.focus();
}
$("#close-status-viewer").addEventListener("click", closeStatusViewer);
$("#delete-status-button").addEventListener("click", async () => {
  const row = activeViewedStatus; if (!row || row.user_id !== currentUser?.id) return;
  const button = $("#delete-status-button"); button.disabled = true;
  try {
    const { error } = await supabase.from("statuses").delete().eq("id", row.id).eq("user_id", currentUser.id);
    if (error) throw error;
    if (row.media_path) {
      const removed = await supabase.storage.from("mersal-attachments").remove([row.media_path]);
      if (removed.error) console.warn("تعذر حذف ملف الحالة:", removed.error.message);
    }
    closeStatusViewer();
    await loadStatuses();
    $("#add-status-button").focus();
    announce("تم حذف الحالة.");
  } catch (error) { announce("تعذر حذف الحالة: " + (error.message || "حاول مرة أخرى."), "error"); }
  finally { button.disabled = false; }
});
statusComposerPanel.addEventListener("keydown", event => { if (event.key === "Escape") closeStatusComposer(); });
statusViewerPanel.addEventListener("keydown", event => { if (event.key === "Escape") closeStatusViewer(); });

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
  const {data:hiddenRows,error:hiddenError}=await supabase.from("conversation_hidden_for").select("conversation_id,hidden_at").eq("user_id",currentUser.id);
  if(hiddenError)throw hiddenError;
  const hiddenMap=new Map((hiddenRows||[]).map(row=>[row.conversation_id,row.hidden_at]));
  const visibleConversations=[];
  for(const conversation of conversations){
    const hiddenAt=hiddenMap.get(conversation.id);
    if(!hiddenAt){visibleConversations.push(conversation);continue;}
    const latestAt=conversation.last_message_at||conversation.created_at||0;
    if(new Date(latestAt)>new Date(hiddenAt)){
      visibleConversations.push(conversation);
      void supabase.from("conversation_hidden_for").delete().eq("conversation_id",conversation.id).eq("user_id",currentUser.id);
    }
  }
  conversations=visibleConversations;
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
  if (activeCall && activeCall.conversationId !== conversation.id) await endVoiceCall(true);
  if (!groupAddPanel.hidden) { groupAddPanel.hidden=true; document.body.classList.remove("group-add-fullscreen"); }
  const {error:hiddenConversationError}=await supabase.from("conversation_hidden_for").delete().eq("conversation_id",conversation.id).eq("user_id",currentUser.id);
  if(hiddenConversationError)console.warn("Could not unhide conversation:",hiddenConversationError.message);
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
  bottomNavigation.hidden = true;
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
  await ensureCallChannel(conversation.id).catch(error => {
    console.warn("Voice call channel:", error);
    announce("تعذر تجهيز المكالمات الصوتية لهذه المحادثة.", "error");
  });
  messageInput.focus();
}

function setConversationInfoValue(element, value) {
  element.textContent = value;
  const group = element.parentElement;
  const label = group?.querySelector(".conversation-info-label")?.textContent?.trim();
  if (group && label) group.setAttribute("aria-label", label + "، " + value);
}

async function loadBlockState(){
  activeBlockState={blockedByMe:false,blockedByThem:false};
  if(!activeConversation||activeConversation.is_group||!activePartner){updateBlockedControls();return;}
  const {data,error}=await supabase.from("user_blocks").select("blocker_id,blocked_id")
    .or("and(blocker_id.eq."+currentUser.id+",blocked_id.eq."+activePartner.id+"),and(blocker_id.eq."+activePartner.id+",blocked_id.eq."+currentUser.id+")");
  if(error)throw error;
  for(const row of data||[]){
    if(row.blocker_id===currentUser.id)activeBlockState.blockedByMe=true;
    if(row.blocker_id===activePartner.id)activeBlockState.blockedByThem=true;
  }
  updateBlockedControls();
}
function isPrivateConversationBlocked(){
  return Boolean(activeConversation&&!activeConversation.is_group&&(activeBlockState.blockedByMe||activeBlockState.blockedByThem));
}
function updateBlockedControls(){
  if(!blockPersonButton)return;
  const blocked=isPrivateConversationBlocked();
  messageInput.disabled=blocked;
  sendButton.disabled=blocked;
  attachButton.disabled=blocked;
  voiceCallButton.disabled=blocked;
  messageInput.placeholder=blocked?"لا يمكن إرسال الرسائل بسبب الحظر.":"اكتب رسالتك هنا…";
  blockPersonButton.textContent=activeBlockState.blockedByMe?"إلغاء الحظر":activeBlockState.blockedByThem?"هذا الشخص حظرك":"حظر الشخص";
  blockPersonButton.disabled=activeBlockState.blockedByThem&&!activeBlockState.blockedByMe;
  blockPersonButton.setAttribute("aria-label",blockPersonButton.textContent);
}
async function updateConversationInfo() {
  if (!activeConversation || (!activePartner && !activeConversation.is_group)) return;
  const isGroup = Boolean(activeConversation.is_group);
  const { isOwner, isAdmin } = isGroup ? await getCurrentGroupPermissions() : { isOwner: false, isAdmin: false };
  groupAddMembersButton.hidden=!isAdmin;
  blockPersonButton.hidden=isGroup;
  conversationDeleteButton.hidden=false;
  conversationInfoNameLabel.textContent = isGroup ? "اسم المجموعة" : "اسم الشخص";
  conversationInfoStatusRow.hidden = isGroup;
  setConversationInfoValue(conversationInfoName, isGroup ? (activeConversation.group_name || "مجموعة") : displayName(activePartner));
  if (!isGroup) setConversationInfoValue(conversationInfoStatus, onlineUserIds.has(activePartner.id) ? "متصل الآن" : formatLastSeen(activePartnerLastSeenAt));
  const createdAt = activeConversation.created_at;
  setConversationInfoValue(conversationInfoCreated, createdAt ? new Date(createdAt).toLocaleString("ar-JO", { dateStyle: "long", timeStyle: "short" }) : "غير متوفر");
  setConversationInfoValue(conversationInfoCount, "جارٍ التحميل…");
  conversationSearchArea.hidden = true; conversationSearchInput.value = ""; conversationSearchResults.replaceChildren();
  conversationSearchStatus.textContent = "اكتب كلمة لعرض النتائج.";
  groupAdminTools.hidden = !isOwner; groupMemberList.hidden = !isGroup; groupLeaveButton.hidden = !isGroup; groupDeleteEveryoneButton.hidden = !isOwner;
  groupRenameInput.hidden = !isOwner; groupRenameInput.previousElementSibling.hidden = !isOwner; groupRenameSaveButton.hidden = !isOwner;
  groupMemberList.replaceChildren(); groupAddPeople.replaceChildren(); groupAddSearch.value = "";
  if(isGroup){activeBlockState={blockedByMe:false,blockedByThem:false};updateBlockedControls();}
  else await loadBlockState();
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
  if(isGroup)await loadGroupManagement();
}
async function getCurrentGroupPermissions(){
  if(!activeConversation?.is_group||!currentUser)return {isOwner:false,isAdmin:false};
  const isOwner=activeConversation.user_one===currentUser.id;
  if(isOwner)return {isOwner:true,isAdmin:true};
  const {data,error}=await supabase.from("conversation_members").select("role").eq("conversation_id",activeConversation.id).eq("user_id",currentUser.id).maybeSingle();
  if(error){console.warn("تعذر التحقق من صلاحية مشرف المجموعة:",error.message);return {isOwner:false,isAdmin:false};}
  return {isOwner:false,isAdmin:data?.role==="admin"};
}
async function loadGroupManagement(){
  if(!activeConversation?.is_group||!currentUser)return;
  const permissions=await getCurrentGroupPermissions();
  const {data:members,error}=await supabase.from("conversation_members").select("user_id,role").eq("conversation_id",activeConversation.id);
  if(error){announce("تعذر تحميل أعضاء المجموعة: "+error.message,"error");return;}
  activeGroupMemberIds=new Set((members||[]).map(member=>member.user_id));
  const ids=[...activeGroupMemberIds];let profiles=[];
  if(ids.length){const result=await supabase.from("profiles").select("id,display_name").in("id",ids);if(result.error){announce("تعذر تحميل أسماء الأعضاء.","error");return;}profiles=result.data||[];}
  const profileMap=new Map(profiles.map(profile=>[profile.id,profile]));groupMemberList.replaceChildren();
  for(const member of members||[]){
    const isSelf=member.user_id===currentUser.id,isGroupOwner=member.user_id===activeConversation.user_one;
    const name=profileMap.get(member.user_id)?.display_name||"مستخدم مرسال";
    const roleLabel=isGroupOwner?"منشئ المجموعة":member.role==="admin"?"مشرف":"عضو";
    const item=document.createElement("li");
    const memberButton=safeText("button","group-member-name",name+(isSelf?" (أنت)":""));
    memberButton.type="button";
    memberButton.setAttribute("aria-label","خيارات "+name+(isSelf?"، أنت":""));
    memberButton.addEventListener("click",()=>openGroupMemberOptions(member.user_id,name,roleLabel,member.role,isGroupOwner,permissions,memberButton));
    item.append(memberButton,safeText("span","group-member-role",roleLabel));
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
function openGroupMemberOptions(userId,name,roleLabel,role,isGroupOwner,permissions,returnFocus){
  groupMemberOptionsReturnFocus=returnFocus;
  groupMemberOptionsName.textContent=name;
  groupMemberOptionsRole.textContent=roleLabel;
  groupMemberOptionsActions.replaceChildren();
  const isSelf=userId===currentUser?.id;
  if(!isSelf){
    const messageButton=safeText("button","primary-button group-member-action","مراسلة");
    messageButton.type="button";
    messageButton.addEventListener("click",()=>{
      closeGroupMemberOptions();
      void openConversation({id:userId,display_name:name});
    });
    groupMemberOptionsActions.append(messageButton);
  }
  if(!isSelf&&!isGroupOwner){
    if(permissions.isOwner){
      const roleButton=safeText("button","quiet-button group-member-action",role==="admin"?"إزالة صفة المشرف":"تعيين مشرف");
      roleButton.type="button";
      roleButton.addEventListener("click",()=>{void manageGroupMember(userId,name,role==="admin"?"demote":"promote");});
      groupMemberOptionsActions.append(roleButton);
    }
    if(permissions.isOwner||role!=="admin"){
      const remove=safeText("button","danger-button group-member-remove","إزالة من المجموعة");
      remove.type="button";
      remove.addEventListener("click",()=>{void manageGroupMember(userId,name,"remove");});
      groupMemberOptionsActions.append(remove);
    }
  }
  if(!groupMemberOptionsActions.childElementCount){
    groupMemberOptionsActions.append(safeText("p","group-member-no-actions","لا توجد إجراءات متاحة لهذا العضو."));
  }
  groupMemberOptionsPanel.hidden=false;
  document.body.classList.add("group-member-options-fullscreen");
  closeGroupMemberOptionsButton.focus();
}
function closeGroupMemberOptions(){
  groupMemberOptionsPanel.hidden=true;
  document.body.classList.remove("group-member-options-fullscreen");
  if(groupMemberOptionsReturnFocus?.isConnected)groupMemberOptionsReturnFocus.focus();
}
closeGroupMemberOptionsButton.addEventListener("click",closeGroupMemberOptions);
groupMemberOptionsPanel.addEventListener("keydown",event=>{if(event.key==="Escape")closeGroupMemberOptions();});
async function manageGroupMember(userId,name,action){
  if(!activeConversation?.is_group||!currentUser)return;
  const prompts={promote:"هل تريد تعيين "+name+" مشرفًا في المجموعة؟",demote:"هل تريد إزالة صفة المشرف عن "+name+"؟",remove:"هل تريد إزالة "+name+" من المجموعة؟"};
  if(!window.confirm(prompts[action]||"تأكيد الإجراء؟"))return;
  const {error}=await supabase.rpc("manage_group_member",{p_conversation_id:activeConversation.id,p_target_user_id:userId,p_action:action});
  if(error){announce("تعذر تنفيذ الإجراء: "+(error.message||"حاول مرة أخرى."),"error");return;}
  closeGroupMemberOptions();
  await loadGroupManagement();await loadConversations();
  announce(action==="promote"?"تم تعيينه مشرفًا.":action==="demote"?"تمت إزالة صفة المشرف.":"تمت إزالة العضو.");
}
groupAddSearch.addEventListener("input",renderGroupAddPeople);
groupAddMembersButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||!(await getCurrentGroupPermissions()).isAdmin)return;
  conversationInfoPanel.hidden=true;
  document.body.classList.remove("conversation-info-fullscreen");
  groupAddPanel.hidden=false;
  document.body.classList.add("group-add-fullscreen");
  renderGroupAddPeople();
  groupAddSearch.focus();
});
function closeGroupAddPanel(){
  groupAddPanel.hidden=true;
  document.body.classList.remove("group-add-fullscreen");
  groupAddMembersButton.focus();
}
closeGroupAddButton.addEventListener("click",closeGroupAddPanel);
groupAddPanel.addEventListener("keydown",event=>{if(event.key==="Escape")closeGroupAddPanel();});
groupAddSelectedButton.addEventListener("click",async()=>{
  if(!activeConversation?.is_group||!(await getCurrentGroupPermissions()).isAdmin)return;
  const ids=[...selectedAdditionalMembers].filter(id=>!activeGroupMemberIds.has(id));
  if(!ids.length){announce("اختر شخصًا واحدًا على الأقل.","error");return;}
  groupAddSelectedButton.disabled=true;
  try{const rows=ids.map(user_id=>({conversation_id:activeConversation.id,user_id,role:"member"}));const {error}=await supabase.from("conversation_members").insert(rows);if(error)throw error;selectedAdditionalMembers.clear();await loadGroupManagement();await loadConversations();closeGroupAddPanel();announce("تمت إضافة الأعضاء.");}
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
async function deleteActiveGroup(deleteForEveryone){
  if(!activeConversation?.is_group||!currentUser)return;
  if(deleteForEveryone&&activeConversation.user_one!==currentUser.id)return;
  const confirmation=deleteForEveryone
    ?"سيتم حذف المجموعة نهائيًا من عند جميع الأعضاء، بما في ذلك الرسائل والملفات. لا يمكن التراجع. هل تريد المتابعة؟"
    :"سيتم حذف المجموعة من قائمتك وإزالتك منها فقط. ستبقى المجموعة وباقي الرسائل متاحة للأعضاء الآخرين. هل تريد المتابعة؟";
  if(!window.confirm(confirmation))return;
  const button=deleteForEveryone?groupDeleteEveryoneButton:groupLeaveButton;
  button.disabled=true;
  try{
    const id=activeConversation.id;
    const result=await supabase.rpc("delete_group",{p_conversation_id:id,p_delete_for_everyone:deleteForEveryone});
    if(result.error)throw result.error;
    if(activeCall)await endVoiceCall(true);
    if(realtimeChannel){await supabase.removeChannel(realtimeChannel);realtimeChannel=null;}
    await closeCallChannel();
    conversationInfoPanel.hidden=true;
    document.body.classList.remove("conversation-info-fullscreen","chat-fullscreen");
    workspace.classList.remove("chat-open");
    chatView.hidden=true;chatEmpty.hidden=false;
    activeConversation=null;activePartner=null;
    await loadConversations();
    announce(deleteForEveryone?"تم حذف المجموعة للجميع.":"تم حذف المجموعة من عندك.");
  }catch(error){
    announce("تعذر حذف المجموعة: "+(error.message||"حاول مرة أخرى."),"error");
  }finally{button.disabled=false;}
}
groupLeaveButton.addEventListener("click",()=>{deleteActiveGroup(false);});
groupDeleteEveryoneButton.addEventListener("click",()=>{deleteActiveGroup(true);});

blockPersonButton.addEventListener("click",async()=>{
  if(!activeConversation||activeConversation.is_group||!activePartner||!currentUser||activeBlockState.blockedByThem&&!activeBlockState.blockedByMe)return;
  if(!activeBlockState.blockedByMe&&!window.confirm("لن يتمكن هذا الشخص من مراسلتك أو الاتصال بك عبر مرسال. هل تريد حظره؟"))return;
  blockPersonButton.disabled=true;
  try{
    if(activeBlockState.blockedByMe){
      const {error}=await supabase.from("user_blocks").delete().eq("blocker_id",currentUser.id).eq("blocked_id",activePartner.id);
      if(error)throw error;
    }else{
      const {error}=await supabase.from("user_blocks").insert({blocker_id:currentUser.id,blocked_id:activePartner.id});
      if(error&&error.code!=="23505")throw error;
    }
    await loadBlockState();
    if(isPrivateConversationBlocked()&&activeCall){await endVoiceCall(true);updateBlockedControls();}
    announce(activeBlockState.blockedByMe?"تم حظر الشخص.":"تم إلغاء الحظر.");
  }catch(error){announce("تعذر تغيير الحظر: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{blockPersonButton.disabled=activeBlockState.blockedByThem&&!activeBlockState.blockedByMe;}
});

conversationDeleteButton.addEventListener("click",async()=>{
  if(!activeConversation||!currentUser)return;
  const id=activeConversation.id,isGroup=Boolean(activeConversation.is_group);
  const label=isGroup?"المجموعة":"الدردشة";
  if(!window.confirm("سيتم حذف "+label+" من قائمتك فقط. لن تُحذف لدى بقية المشاركين، وستظهر مجددًا عند وصول رسالة جديدة. هل تريد المتابعة؟"))return;
  conversationDeleteButton.disabled=true;
  try{
    const {error}=await supabase.from("conversation_hidden_for").insert({conversation_id:id,user_id:currentUser.id});
    if(error&&error.code!=="23505")throw error;
    if(activeCall)await endVoiceCall(true);
    if(realtimeChannel){await supabase.removeChannel(realtimeChannel);realtimeChannel=null;}
    await closeCallChannel();
    conversationInfoPanel.hidden=true;
    groupAddPanel.hidden=true;
    document.body.classList.remove("conversation-info-fullscreen","group-add-fullscreen","chat-fullscreen");
    workspace.classList.remove("chat-open");
    chatView.hidden=true;chatEmpty.hidden=false;
    activeConversation=null;activePartner=null;
    activeBlockState={blockedByMe:false,blockedByThem:false};
    await loadConversations();
    announce("تم حذف الدردشة من قائمتك.");
  }catch(error){announce("تعذر حذف الدردشة: "+(error.message||"حاول مرة أخرى."),"error");}
  finally{conversationDeleteButton.disabled=false;}
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
backToChatsButton.addEventListener("click", async () => {
  setActiveBottomTab("home");
  if (activeCall) await endVoiceCall(true);
  await closeCallChannel();
  document.body.classList.remove("chat-fullscreen");
  workspace.classList.remove("chat-open");
  bottomNavigation.hidden = false;
  chatView.hidden = true;
  chatEmpty.hidden = false;
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  peopleSearch.focus();
});
chatPartnerAccessible.addEventListener("click", async () => {
  if (!activeConversation) return;
  if (status.textContent) status.textContent = "";
  conversationInfoPanel.hidden = false;
  document.body.classList.add("conversation-info-fullscreen");
  await updateConversationInfo();
  closeConversationInfoButton.focus();
});
closeConversationInfoButton.addEventListener("click", () => {
  conversationInfoPanel.hidden = true;
  document.body.classList.remove("conversation-info-fullscreen");
  chatPartnerAccessible.focus();
});


function updateVoiceCallPanel() {
  if (!activeCall) { voiceCallPanel.hidden = true; return; }
  voiceCallPanel.hidden = false;
  voiceCallAcceptButton.hidden = activeCall.accepted || !activeCall.incoming;
  voiceCallRejectButton.hidden = activeCall.accepted || !activeCall.incoming;
  voiceCallMuteButton.hidden = !activeCall.accepted;
  voiceCallEndButton.hidden = !activeCall.accepted;
  voiceCallMuteButton.textContent = activeCall.muted ? "تشغيل الميكروفون" : "كتم الميكروفون";
  voiceCallEndButton.textContent = activeConversation?.is_group && activeCall.initiatorId !== currentUser.id ? "مغادرة المكالمة" : "إنهاء المكالمة";
  voiceCallParticipants.replaceChildren();
  for (const id of activeCall.participants) {
    const profile = people.find(person => person.id === id);
    const name = id === currentUser.id ? "أنت" : (profile ? displayName(profile) : "مشارك في المكالمة");
    voiceCallParticipants.append(safeText("li", "voice-call-participant", name));
  }
}
function setVoiceCallStatus(message) {
  voiceCallStatus.textContent = message;
}
async function ensureCallChannel(conversationId) {
  if (callChannel && callChannelConversationId === conversationId && callChannelReady) return;
  if (callChannel) await closeCallChannel();
  callChannelConversationId = conversationId;
  callChannelReady = false;
  const channel = supabase.channel("mersal-call:" + conversationId, { config: { private: true } });
  callChannel = channel;
  const ready = new Promise((resolve, reject) => {
    let settled = false;
    channel.on("broadcast", { event: "call-signal" }, message => {
      void handleCallSignal(message?.payload || message).catch(error => { console.warn("Call signal:", error); setVoiceCallStatus("حدثت مشكلة في الاتصال الصوتي."); });
    });
    channel.subscribe(state => {
      if (state === "SUBSCRIBED" && !settled) {
        settled = true; callChannelReady = true; resolve();
      } else if ((state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") && !settled) {
        settled = true; callChannelReady = false; reject(new Error("تعذر الاتصال بقناة المكالمة."));
      }
    });
  });
  callChannelPromise = ready;
  return ready;
}
async function closeCallChannel() {
  const channel = callChannel;
  callChannel = null; callChannelConversationId = null; callChannelReady = false; callChannelPromise = null;
  if (channel) await supabase.removeChannel(channel);
}
async function sendCallSignal(type, to, details = {}, callId = activeCall?.id) {
  if (!callChannel || !callChannelReady || !activeCall || !callId) throw new Error("قناة المكالمة غير جاهزة.");
  const result = await callChannel.send({
    type: "broadcast",
    event: "call-signal",
    payload: { type, callId, conversationId: activeCall.conversationId, from: currentUser.id, to, details }
  });
  if (result !== "ok") throw new Error("تعذر إرسال إشارة المكالمة.");
}
async function sendCallSignalToAll(type, details = {}) {
  if (!activeCall) return;
  const targets = [...activeCall.participants].filter(id => id !== currentUser.id);
  await Promise.all(targets.map(id => sendCallSignal(type, id, details)));
}
async function getVoiceCallParticipantIds() {
  if (!activeConversation || !activePartner) return [];
  if (!activeConversation.is_group) return [activePartner.id].filter(id => id && id !== currentUser.id);
  const { data, error } = await supabase.from("conversation_members")
    .select("user_id").eq("conversation_id", activeConversation.id);
  if (error) throw error;
  return [...new Set((data || []).map(row => row.user_id).filter(id => id && id !== currentUser.id))];
}
async function startVoiceCall() {
  if (!activeConversation || !currentUser || activeCall) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
    announce("المكالمات الصوتية تحتاج متصفحًا آمنًا يدعم الميكروفون.", "error"); return;
  }
  voiceCallButton.disabled = true;
  try {
    if (!callChannelReady) await callChannelPromise;
    const participants = await getVoiceCallParticipantIds();
    if (!participants.length) throw new Error("لا يوجد مشاركون متاحون في هذه المحادثة.");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    const participantSet = new Set([currentUser.id, ...participants]);
    activeCall = {
      id: crypto.randomUUID(), conversationId: activeConversation.id,
      initiatorId: currentUser.id, participants: participantSet, accepted: true,
      incoming: false, muted: false, localStream: stream, peers: new Map(),
      readyUsers: new Set([currentUser.id]), pendingOffers: new Map(), pendingIce: new Map()
    };
    updateVoiceCallPanel();
    voiceCallEndButton.focus();
    setVoiceCallStatus("جارٍ الاتصال بالمشاركين…");
    await Promise.all(participants.map(id => sendCallSignal("invite", id, {
      participants: [...participantSet], initiatorId: currentUser.id
    })));
    await sendCallSignalToAll("ready");
  } catch (error) {
    if (activeCall) await endVoiceCall(true);
    else await finishVoiceCall();
    announce("تعذر بدء المكالمة: " + (error.message || "تحقق من إذن الميكروفون."), "error");
  } finally {
    voiceCallButton.disabled = false;
  }
}
function createVoicePeer(peerId) {
  if (!activeCall || activeCall.peers.has(peerId)) return activeCall?.peers.get(peerId) || null;
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  });
  activeCall.peers.set(peerId, pc);
  for (const track of activeCall.localStream.getAudioTracks()) pc.addTrack(track, activeCall.localStream);
  pc.onicecandidate = event => {
    if (event.candidate && activeCall?.peers.get(peerId) === pc) {
      void sendCallSignal("ice", peerId, { candidate: event.candidate.toJSON() }).catch(error => console.warn(error));
    }
  };
  pc.ontrack = event => {
    if (activeCall?.peers.get(peerId) !== pc) return;
    let audio = voiceCallAudio.querySelector('[data-peer-id="' + peerId + '"]');
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true; audio.playsInline = true;
      audio.dataset.peerId = peerId;
      voiceCallAudio.append(audio);
    }
    audio.srcObject = event.streams[0];
    void audio.play().catch(() => setVoiceCallStatus("المكالمة متصلة. اضغط على الشاشة للسماح بتشغيل الصوت."));
  };
  pc.onconnectionstatechange = () => {
    if (activeCall?.peers.get(peerId) !== pc) return;
    const states = [...activeCall.peers.values()].map(peer => peer.connectionState);
    if (states.includes("connected")) setVoiceCallStatus("المكالمة الصوتية متصلة.");
    else if (states.some(state => state === "failed" || state === "disconnected")) {
      setVoiceCallStatus("الاتصال بأحد المشاركين غير مستقر. تحقق من الشبكة.");
    }
  };
  return pc;
}
async function flushVoiceIce(peerId, pc) {
  const pending = activeCall?.pendingIce.get(peerId) || [];
  if (!activeCall) return;
  activeCall.pendingIce.delete(peerId);
  for (const candidate of pending) {
    try { await pc.addIceCandidate(candidate); } catch (error) { console.warn("ICE candidate:", error); }
  }
}
async function maybeCreateVoiceOffer(peerId) {
  if (!activeCall?.accepted || !activeCall.readyUsers.has(peerId) || currentUser.id.localeCompare(peerId) >= 0) return;
  if (activeCall.peers.has(peerId)) return;
  const pc = createVoicePeer(peerId);
  if (!pc) return;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendCallSignal("offer", peerId, { description: pc.localDescription.toJSON() });
}
async function handleVoiceOffer(from, description) {
  if (!activeCall?.accepted) { activeCall?.pendingOffers.set(from, description); return; }
  const pc = createVoicePeer(from);
  if (!pc || pc.remoteDescription) return;
  await pc.setRemoteDescription(description);
  await flushVoiceIce(from, pc);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await sendCallSignal("answer", from, { description: pc.localDescription.toJSON() });
}
async function handleCallSignal(signal) {
  if (!signal || !currentUser || signal.conversationId !== activeConversation?.id || signal.to !== currentUser.id || signal.from === currentUser.id) return;
  if(isPrivateConversationBlocked())return;
  const from = signal.from, details = signal.details || {};
  if (signal.type === "invite") {
    if (activeCall) {
      if (activeCall.id !== signal.callId) {
        try { await sendCallSignal("busy", from, {}, signal.callId); } catch {}
      }
      return;
    }
    activeCall = {
      id: signal.callId, conversationId: signal.conversationId,
      initiatorId: details.initiatorId || from,
      participants: new Set(details.participants || [from, currentUser.id]),
      accepted: false, incoming: true, muted: false, localStream: null,
      peers: new Map(), readyUsers: new Set([from]),
      pendingOffers: new Map(), pendingIce: new Map()
    };
    updateVoiceCallPanel();
    setVoiceCallStatus((people.find(person => person.id === from) ? displayName(people.find(person => person.id === from)) : "أحد المشاركين") + " يتصل بك صوتيًا.");
    voiceCallAcceptButton.focus();
    return;
  }
  if (!activeCall || activeCall.id !== signal.callId) return;
  if (signal.type === "ready") {
    activeCall.readyUsers.add(from);
    if (activeCall.accepted) await maybeCreateVoiceOffer(from);
  } else if (signal.type === "offer") {
    if (!activeCall.accepted) activeCall.pendingOffers.set(from, details.description);
    else await handleVoiceOffer(from, details.description);
  } else if (signal.type === "answer") {
    const pc = activeCall.peers.get(from);
    if (pc && !pc.remoteDescription) {
      await pc.setRemoteDescription(details.description);
      await flushVoiceIce(from, pc);
    }
  } else if (signal.type === "ice") {
    const pc = activeCall.peers.get(from);
    if (pc?.remoteDescription) {
      try { await pc.addIceCandidate(details.candidate); } catch (error) { console.warn("ICE candidate:", error); }
    } else {
      const queue = activeCall.pendingIce.get(from) || [];
      queue.push(details.candidate); activeCall.pendingIce.set(from, queue);
    }
  } else if (signal.type === "decline") {
    setVoiceCallStatus("رفض أحد المشاركين المكالمة.");
    if (!activeConversation?.is_group) await finishVoiceCall();
  } else if (signal.type === "busy") {
    setVoiceCallStatus("أحد المشاركين مشغول حاليًا.");
  } else if (signal.type === "leave") {
    const pc = activeCall.peers.get(from); if (pc) pc.close();
    activeCall.peers.delete(from); activeCall.participants.delete(from); activeCall.readyUsers.delete(from);
    voiceCallAudio.querySelector('[data-peer-id="' + from + '"]')?.remove();
    updateVoiceCallPanel();
    if (activeCall.participants.size <= 1) await finishVoiceCall();
  } else if (signal.type === "end") {
    await finishVoiceCall();
  }
}
async function acceptVoiceCall() {
  if (!activeCall?.incoming || activeCall.accepted) return;
  voiceCallAcceptButton.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    activeCall.localStream = stream;
    activeCall.accepted = true;
    activeCall.readyUsers.add(currentUser.id);
    updateVoiceCallPanel();
    voiceCallMuteButton.focus();
    setVoiceCallStatus("تم الانضمام. جارٍ توصيل الصوت…");
    await sendCallSignalToAll("ready");
    for (const [peerId, description] of [...activeCall.pendingOffers]) {
      activeCall.pendingOffers.delete(peerId);
      await handleVoiceOffer(peerId, description);
    }
    for (const peerId of activeCall.readyUsers) await maybeCreateVoiceOffer(peerId);
  } catch (error) {
    announce("تعذر الرد على المكالمة: " + (error.message || "تحقق من إذن الميكروفون."), "error");
    await rejectVoiceCall();
  } finally {
    voiceCallAcceptButton.disabled = false;
  }
}
async function rejectVoiceCall() {
  if (!activeCall) return;
  const caller = activeCall.initiatorId;
  try { await sendCallSignal("decline", caller); } catch {}
  await finishVoiceCall();
}
function toggleVoiceCallMute() {
  if (!activeCall?.localStream) return;
  activeCall.muted = !activeCall.muted;
  for (const track of activeCall.localStream.getAudioTracks()) track.enabled = !activeCall.muted;
  updateVoiceCallPanel();
  setVoiceCallStatus(activeCall.muted ? "الميكروفون مكتوم." : "الميكروفون يعمل.");
}
async function endVoiceCall(notifyOthers = true) {
  if (!activeCall) { voiceCallPanel.hidden = true; return; }
  if (notifyOthers) {
    const wasAccepted = activeCall.accepted;
    const caller = activeCall.initiatorId;
    const shouldEndForEveryone = !activeConversation?.is_group || caller === currentUser?.id;
    try {
      if (wasAccepted && shouldEndForEveryone) await sendCallSignalToAll("end");
      else if (wasAccepted) await sendCallSignalToAll("leave");
      else await sendCallSignal("decline", caller);
    } catch (error) { console.warn("End call signal:", error); }
  }
  await finishVoiceCall();
}
async function finishVoiceCall() {
  const call = activeCall;
  activeCall = null;
  if (call?.peers) for (const pc of call.peers.values()) pc.close();
  if (call?.localStream) for (const track of call.localStream.getTracks()) track.stop();
  voiceCallAudio.replaceChildren();
  voiceCallPanel.hidden = true;
  if (voiceCallButton?.isConnected && !chatView.hidden) voiceCallButton.focus();
}
voiceCallButton.addEventListener("click", () => { void startVoiceCall(); });
voiceCallAcceptButton.addEventListener("click", () => { void acceptVoiceCall(); });
voiceCallRejectButton.addEventListener("click", () => { void rejectVoiceCall(); });
voiceCallMuteButton.addEventListener("click", toggleVoiceCallMute);
voiceCallEndButton.addEventListener("click", () => { void endVoiceCall(); });
voiceCallPanel.addEventListener("keydown", event => {
  if (event.key === "Escape" && activeCall) { event.preventDefault(); void endVoiceCall(); }
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
      if (attachment.kind === "voice" || attachment.type?.startsWith("audio/")) {
        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = data.signedUrl;
        audio.setAttribute("aria-label", attachment.kind === "voice" ? "تشغيل الرسالة الصوتية" : "تشغيل الملف الصوتي");
        audio.className = "message-audio";
        attachmentView.append(audio);
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
  toggle.setAttribute("aria-label", "خيارات الرسالة");
  toggle.setAttribute("aria-haspopup", "dialog");
  toggle.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "message-options";
  menu.setAttribute("aria-label", "خيارات الرسالة");
  menu.hidden = true;
  menu._home = actions;
  const closeButton = safeText("button", "message-option-button message-options-close", "إغلاق الخيارات");
  closeButton.type = "button";
  closeButton.addEventListener("click", () => closeMessageOptions(menu, toggle));
  toggle.addEventListener("click", () => {
    menu.hidden = false;
    menu.classList.add("is-open");
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-modal", "true");
    toggle.setAttribute("aria-expanded", "true");
    document.body.append(menu);
    closeButton.focus();
  });
  const copyButton = safeText("button", "message-option-button", "نسخ الرسالة");
  copyButton.setAttribute("aria-label", "نسخ الرسالة");
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
  replyButton.setAttribute("aria-label", "الرد على الرسالة");
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
  deleteMineButton.setAttribute("aria-label", "حذف الرسالة لدي فقط");
  deleteMineButton.type = "button";
  deleteMineButton.addEventListener("click", () => { void deleteMessageForMe(message, item, menu, toggle); });
  const deleteEveryoneButton = safeText("button", "message-option-button message-delete-everyone-button", "حذف لدى الجميع");
  deleteEveryoneButton.setAttribute("aria-label", "حذف الرسالة لدى الجميع");
  deleteEveryoneButton.type = "button";
  deleteEveryoneButton.disabled = message.sender_id !== currentUser.id;
  deleteEveryoneButton.setAttribute("aria-label", message.sender_id === currentUser.id ? "حذف هذه الرسالة لدى الجميع" : "حذف لدى الجميع، متاح لرسائلك أنت فقط");
  deleteEveryoneButton.addEventListener("click", () => { void deleteMessageForEveryone(message, item, menu, toggle); });
  menu.append(closeButton, copyButton, replyButton, deleteMineButton, deleteEveryoneButton);
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

async function uploadAttachments(fileList, options = {}) {
  const files = [...(fileList || [])];
  if (!files.length || !currentUser || !activeConversation) return;
  if(isPrivateConversationBlocked()){announce("لا يمكنك إرسال مرفقات في هذه المحادثة بسبب الحظر.","error");return;}
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
      const attachment = { path: uploaded.path, name: file.name, type: file.type || "application/octet-stream", size: file.size, ...(options.voiceMessage ? { kind: "voice" } : {}) };
      const body = (options.voiceMessage ? "رسالة صوتية" : "📎 " + file.name) + "\\nMERSAL_ATTACHMENT:" + JSON.stringify(attachment);
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
  if(isPrivateConversationBlocked()){announce("لا يمكنك إرسال رسائل في هذه المحادثة بسبب الحظر.","error");return;}
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
