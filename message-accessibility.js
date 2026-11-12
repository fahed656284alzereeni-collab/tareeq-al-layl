// Accessible message focus and spoken date/time for VoiceOver and TalkBack.
function enhanceMersalMessages(root = document) {
  const items = root.matches?.("li.message") ? [root] : [...root.querySelectorAll?.("li.message") || []];
  for (const item of items) {
    const body = item.querySelector(".message-body");
    const attachmentName = item.querySelector(".attachment-file-name");
    let time = item.querySelector("time.message-time");
    if (!time && item.dataset.messageCreatedAt) {
      const date = new Date(item.dataset.messageCreatedAt);
      if (!Number.isNaN(date.getTime())) {
        time = document.createElement("time");
        time.className = "message-time";
        time.dateTime = item.dataset.messageCreatedAt;
        time.textContent = new Intl.DateTimeFormat("ar-JO", { dateStyle: "short", timeStyle: "short" }).format(date);
        item.append(time);
      }
    }
    if (time?.dateTime) item.dataset.messageCreatedAt = time.dateTime;
    const messageText = item.classList.contains("message-deleted")
      ? "تم حذف هذه الرسالة"
      : (body?.textContent || attachmentName?.textContent?.replace(/^📎\s*/, "") || "مرفق").trim();
    const date = item.dataset.messageCreatedAt ? new Date(item.dataset.messageCreatedAt) : null;
    const spokenDateTime = date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat("ar-JO", { dateStyle: "full", timeStyle: "short" }).format(date)
      : (time?.textContent || "");
    item.setAttribute("role", "group");
    item.tabIndex = 0;
    item.setAttribute("aria-label", "الرسالة: " + messageText + (spokenDateTime ? ". التاريخ والوقت: " + spokenDateTime : ""));
    body?.setAttribute("aria-hidden", "true");
    attachmentName?.setAttribute("aria-hidden", "true");
    time?.setAttribute("aria-hidden", "true");
    const options = item.querySelector(".message-options-toggle");
    if (options) {
      options.setAttribute("aria-label", "إجراءات الرسالة");
      options.setAttribute("aria-description", "افتح لعرض الإجراءات المتاحة لهذه الرسالة.");
    }
  }
}
function observeMersalMessages() {
  const list = document.getElementById("messages");
  if (!list) return;
  enhanceMersalMessages(list);
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) enhanceMersalMessages(node);
      }
      if (record.type === "childList" && record.target instanceof Element && record.target.matches("li.message")) {
        enhanceMersalMessages(record.target);
      }
    }
  }).observe(list, { childList: true, subtree: true });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", observeMersalMessages, { once: true });
} else {
  observeMersalMessages();
}
