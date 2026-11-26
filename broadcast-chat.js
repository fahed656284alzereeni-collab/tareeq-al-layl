import { supabase } from "./supabase-client.js?v=20261116-auth-bootstrap-v1";

(() => {
  const $ = selector => document.querySelector(selector);
  const listHost = $("#broadcast-lists");
  const panel = $("#broadcast-panel");
  const listsView = $("#broadcast-lists-view");
  const closePanel = $("#close-broadcast-panel");
  const chatView = $("#chat-view");
  const chatEmpty = $("#chat-empty");
  const workspace = $("#workspace");
  const bottomNavigation = $("#bottom-navigation");
  const backButton = $("#back-to-chats");
  const titleButton = $("#chat-partner-accessible");
  const title = $("#chat-partner-name");
  const presence = $("#chat-partner-presence");
  const messages = $("#messages");
  const form = $("#message-form");
  const input = $("#message-input");
  const sendButton = $("#send-button");
  const attachButton = $("#attach-button");
  const calls = [$("#voice-call-button"), $("#video-call-button")].filter(Boolean);
  const status = $("#status");
  if (!listHost || !panel || !chatView || !form || !input || !messages) return;

  let activeList = null;
  let returnButton = null;
  let sending = false;

  const english = () => document.documentElement.lang === "en";
  const say = (ar, en = ar) => {
    if (status) status.textContent = english() ? en : ar;
  };
  const safe = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value ?? "";
    return node;
  };
  const formatTime = value => new Date(value).toLocaleTimeString(
    english() ? "en-US" : "ar-JO", { hour: "numeric", minute: "2-digit" }
  );

  function renderMessage(row) {
    const item = safe("li", "message mine", "");
    item.dataset.broadcastMessageId = row.id;
    item.append(safe("p", "message-body", row.body));
    const footer = safe("div", "message-footer", "");
    footer.append(safe("time", "message-time", formatTime(row.created_at)));
    const state = safe("span", "message-delivery-state", "");
    state.setAttribute("aria-label", (english() ? "Sent to " : "تم الإرسال إلى ") + (row.sent_count || 0) + (english() ? " recipients" : " مستلمين"));
    state.append(safe("span", "message-status-text", (english() ? "Sent to " : "تم الإرسال إلى ") + (row.sent_count || 0) + (english() ? " recipients" : " مستلمين")));
    footer.append(state);
    item.append(footer);
    return item;
  }

  async function loadHistory(list) {
    messages.replaceChildren(safe("li", "empty-item", english() ? "Loading messages…" : "جارٍ تحميل رسائل القائمة…"));
    const { data, error } = await supabase.from("broadcast_messages")
      .select("id,body,created_at,sent_count")
      .eq("broadcast_list_id", list.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (activeList?.id !== list.id) return;
    messages.replaceChildren();
    if (error) {
      messages.append(safe("li", "empty-item", english() ? "Could not load list messages." : "تعذر تحميل رسائل القائمة."));
      say("تعذر تحميل رسائل القائمة: " + error.message, "Could not load broadcast messages: " + error.message);
      return;
    }
    if (!data?.length) messages.append(safe("li", "empty-item", english() ? "This is the beginning of the conversation. Send the first message." : "هذه بداية المحادثة. أرسل أول رسالة."));
    for (const row of data || []) messages.append(renderMessage(row));
    messages.scrollTop = messages.scrollHeight;
  }

  async function getOrCreateConversation(recipientId, ownerId) {
    const [one, two] = [ownerId, recipientId].sort();
    const existing = await supabase.from("conversations").select("id")
      .eq("user_one", one).eq("user_two", two).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data.id;
    const created = await supabase.from("conversations").insert({ user_one: one, user_two: two })
      .select("id").single();
    if (!created.error) return created.data.id;
    if (created.error.code !== "23505") throw created.error;
    const retry = await supabase.from("conversations").select("id")
      .eq("user_one", one).eq("user_two", two).single();
    if (retry.error) throw retry.error;
    return retry.data.id;
  }

  async function sendToList(body) {
    if (!activeList || sending) return;
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    const sender = userResult?.user;
    if (userError || !sender) throw userError || new Error("انتهت جلسة تسجيل الدخول.");
    const { data: members, error } = await supabase.from("broadcast_list_members")
      .select("recipient_id").eq("broadcast_list_id", activeList.id);
    if (error) throw error;
    if (!members?.length) throw new Error("قائمة الرسائل الجماعية لا تحتوي على مستلمين.");

    sending = true;
    sendButton.disabled = true;
    let sent = 0;
    let failed = 0;
    try {
      for (const member of members) {
        if (activeList === null) return;
        try {
          const conversationId = await getOrCreateConversation(member.recipient_id, sender.id);
          const result = await supabase.from("messages").insert({
            conversation_id: conversationId, sender_id: sender.id, body
          }).select("id").single();
          if (result.error) throw result.error;
          sent++;
          void supabase.functions.invoke("send-push", { body: { message_id: result.data.id } })
            .then(({ error: pushError }) => { if (pushError) console.warn("Broadcast push:", pushError.message); })
            .catch(pushError => console.warn("Broadcast push request:", pushError));
        } catch (deliveryError) {
          failed++;
          console.warn("Broadcast recipient delivery failed:", deliveryError?.message || deliveryError);
        }
      }
      if (sent > 0) {
        const saved = await supabase.from("broadcast_messages").insert({
          broadcast_list_id: activeList.id, sender_id: sender.id, body,
          sent_count: sent, failed_count: failed
        }).select("id,body,created_at,sent_count").single();
        if (saved.error) throw saved.error;
        if (activeList) {
          messages.querySelector(".empty-item")?.remove();
          messages.append(renderMessage(saved.data));
          messages.scrollTop = messages.scrollHeight;
        }
      }
      input.value = "";
      say(
        failed ? "تم إرسال الرسالة إلى " + sent + " مستلمين، وتعذر إرسالها إلى " + failed + "." : "تم إرسال الرسالة إلى جميع المستلمين وعددهم " + sent + ".",
        failed ? "Message sent to " + sent + " recipients; " + failed + " failed." : "Message sent to all " + sent + " recipients."
      );
    } finally {
      sending = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  async function openList(list, button) {
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult?.user) {
      say("يرجى تسجيل الدخول مجددًا.", "Please sign in again.");
      return;
    }
    const { data: members, error } = await supabase.from("broadcast_list_members")
      .select("recipient_id").eq("broadcast_list_id", list.id);
    if (error) {
      say("تعذر فتح قائمة الرسائل الجماعية: " + error.message, "Could not open broadcast list: " + error.message);
      return;
    }
    activeList = { ...list, memberCount: members?.length || 0 };
    for (const channel of supabase.getChannels()) {
      if (String(channel.topic || "").includes("messages-")) void supabase.removeChannel(channel);
    }
    returnButton = button;
    panel.hidden = true;
    chatEmpty.hidden = true;
    chatView.hidden = false;
    workspace.classList.add("chat-open");
    document.body.classList.add("chat-fullscreen");
    bottomNavigation.hidden = true;
    title.textContent = list.name;
    titleButton.setAttribute("aria-label", list.name + (english() ? ", broadcast list" : "، قائمة رسائل جماعية"));
    presence.textContent = english()
      ? "Broadcast list · " + activeList.memberCount + " recipients"
      : "قائمة رسائل جماعية · " + activeList.memberCount + " مستلمين";
    calls.forEach(button => { button.hidden = true; });
    if (attachButton) attachButton.hidden = true;
    input.disabled = false;
    input.placeholder = english() ? "Write a message to the list…" : "اكتب رسالتك للقائمة…";
    messages.setAttribute("aria-label", english() ? "Broadcast list messages" : "رسائل القائمة الجماعية");
    await loadHistory(activeList);
    titleButton.focus();
  }

  listHost.addEventListener("click", event => {
    const button = event.target.closest(".broadcast-list-send");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const listId = button.dataset.broadcastListId;
    if (!listId) {
      say("تعذر تحديد القائمة. حدّث الصفحة وحاول مرة أخرى.", "Could not identify the list. Refresh and try again.");
      return;
    }
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data?.user) throw error || new Error("انتهت جلسة تسجيل الدخول.");
      const result = await supabase.from("broadcast_lists").select("id,name")
        .eq("id", listId).eq("owner_id", data.user.id).single();
      if (result.error) throw result.error;
      await openList(result.data, button);
    }).catch(error => say("تعذر فتح القائمة: " + (error.message || "حاول مرة أخرى."), "Could not open list: " + (error.message || "Try again.")));
  }, true);

  form.addEventListener("submit", event => {
    if (!activeList) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const body = input.value.trim();
    if (!body) {
      say("اكتب رسالتك قبل الإرسال.", "Write a message before sending.");
      input.focus();
      return;
    }
    if (body.length > 5000) {
      say("الحد الأقصى للرسالة 5000 حرف.", "Messages can contain up to 5000 characters.");
      return;
    }
    void sendToList(body).catch(error => say("تعذر إرسال الرسالة: " + (error.message || "حاول مرة أخرى."), "Could not send message: " + (error.message || "Try again.")));
  }, true);

  titleButton?.addEventListener("click", event => {
    if (!activeList) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    say("هذه معلومات قائمة الرسائل الجماعية. عدد المستلمين: " + activeList.memberCount, "Broadcast list. Recipients: " + activeList.memberCount);
  }, true);

  backButton.addEventListener("click", event => {
    if (!activeList) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activeList = null;
    chatView.hidden = true;
    chatEmpty.hidden = false;
    workspace.classList.remove("chat-open");
    document.body.classList.remove("chat-fullscreen");
    bottomNavigation.hidden = false;
    calls.forEach(button => { button.hidden = false; });
    if (attachButton) attachButton.hidden = false;
    panel.hidden = false;
    if (listsView) listsView.hidden = false;
    if (returnButton?.isConnected) returnButton.focus();
    else closePanel?.focus();
  }, true);

  $("#conversation-list")?.addEventListener("click", () => { activeList = null; }, true);
  $("#new-chat-button")?.addEventListener("click", () => { activeList = null; }, true);
})();
