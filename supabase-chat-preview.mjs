import { supabase } from "./supabase-client.js";
import { createSupabaseChatApi } from "./supabase-chat-api.mjs";

const api = createSupabaseChatApi({ getAccessToken: async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session?.access_token || null;
}});
const $ = id => document.getElementById(id);
const status = message => { $("status").textContent = message; };
let currentUser = null;
let currentConversationId = null;
let currentChannel = null;
let profilesById = new Map();

function makeButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "item";
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

async function requireSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) {
    window.location.replace("./supabase-auth-preview.html");
    return null;
  }
  currentUser = session.user;
  return session;
}

async function loadConversations() {
  const result = await api.listConversations();
  const list = $("conversationList");
  list.replaceChildren();
  for (const item of result.conversations || []) {
    const row = document.createElement("li");
    const label = item.title || (item.type === "group" ? "مجموعة" : "محادثة مباشرة");
    row.append(makeButton(label, () => openConversation(item.id)));
    list.append(row);
  }
  if (!list.children.length) {
    const empty = document.createElement("li");
    empty.textContent = "لا توجد محادثات بعد.";
    list.append(empty);
  }
}

async function openConversation(conversationId) {
  currentConversationId = conversationId;
  const result = await api.getConversation(conversationId);
  const conversation = result.conversation;
  profilesById = new Map((conversation.members || []).map(member => [
    member.user_id,
    member.profile?.display_name || member.profile?.username || "مستخدم"
  ]));
  const otherNames = (conversation.members || [])
    .filter(member => member.user_id !== currentUser.id)
    .map(member => member.profile?.display_name || member.profile?.username || "مستخدم");
  $("conversationName").textContent = conversation.title || otherNames.join("، ") || "محادثة";
  $("chatPanel").hidden = false;
  if (currentChannel) await supabase.removeChannel(currentChannel);
  currentChannel = supabase.channel("mersal-preview-" + conversationId)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "messages",
      filter: "conversation_id=eq." + conversationId
    }, () => loadMessages())
    .subscribe();
  await loadMessages();
}

async function loadMessages() {
  if (!currentConversationId) return;
  const result = await api.listMessages(currentConversationId,{limit:100});
  const list = $("messages");
  list.replaceChildren();
  const unread = [];
  for (const message of result.messages || []) {
    const item = document.createElement("li");
    item.className = "message";
    const author = document.createElement("strong");
    author.textContent = message.sender_id === currentUser.id
      ? "أنت"
      : (profilesById.get(message.sender_id) || "مستخدم");
    const body = document.createElement("span");
    body.textContent = message.body || (message.attachment ? "مرفق: " + (message.attachment.name || "ملف") : "");
    item.append(author,body);
    list.append(item);
    if (message.sender_id !== currentUser.id && !message.read_at) unread.push(message.id);
  }
  if (!list.children.length) {
    const empty = document.createElement("li");
    empty.textContent = "ابدأ المحادثة برسالة جديدة.";
    list.append(empty);
  }
  for (const messageId of unread) {
    try { await api.markMessageRead(messageId); } catch (_) {}
  }
}

$("refresh").addEventListener("click", async () => {
  try { await loadConversations(); status("تم تحديث قائمة المحادثات."); }
  catch (error) { status("تعذر تحديث المحادثات: " + error.message); }
});

$("searchForm").addEventListener("submit", async event => {
  event.preventDefault();
  const term = $("searchInput").value.trim();
  if (term.length < 2) return;
  try {
    const result = await api.searchUsers(term);
    const list = $("searchResults");
    list.replaceChildren();
    for (const user of result.users || []) {
      const item = document.createElement("li");
      const name = user.display_name || user.username || "مستخدم";
      item.append(makeButton(name, async () => {
        try {
          const created = await api.createDirectConversation(user.id);
          await loadConversations();
          await openConversation(created.conversationId);
          status("تم فتح المحادثة.");
        } catch (error) { status("تعذر بدء المحادثة: " + error.message); }
      }));
      list.append(item);
    }
    if (!list.children.length) {
      const empty = document.createElement("li");
      empty.textContent = "لم يتم العثور على مستخدمين.";
      list.append(empty);
    }
    status("اكتمل البحث.");
  } catch (error) { status("تعذر البحث: " + error.message); }
});

$("sendForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentConversationId) return;
  const body = $("messageInput").value.trim();
  const file = $("attachmentInput").files?.[0] || null;
  if (!body && !file) { status("اكتب رسالة أو اختر ملفًا."); return; }
  try {
    let attachment = null;
    if (file) {
      status("جارٍ رفع المرفق...");
      attachment = await api.uploadMedia(currentConversationId,file);
    }
    await api.sendMessage({conversationId:currentConversationId,body,attachment});
    $("messageInput").value = "";
    $("attachmentInput").value = "";
    await loadMessages();
    await loadConversations();
    status("تم إرسال الرسالة.");
  } catch (error) { status("تعذر إرسال الرسالة: " + error.message); }
});

$("signout").addEventListener("click", async () => {
  if (currentChannel) await supabase.removeChannel(currentChannel);
  const { error } = await supabase.auth.signOut();
  if (error) { status("تعذر تسجيل الخروج: " + error.message); return; }
  window.location.replace("./supabase-auth-preview.html");
});

try {
  const session = await requireSession();
  if (session) {
    status("تم التحقق من جلسة Supabase. جارٍ تحميل المحادثات...");
    await loadConversations();
    status("جاهز. هذه معاينة مستقلة وليست واجهة مرسال الأساسية.");
  }
} catch (error) {
  status("تعذر تشغيل معاينة المحادثات: " + error.message);
}
