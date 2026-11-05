self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const isCall = data.type === "incomingCall";
  const title = String(data.title || "إشعار جديد من مِرسالو");
  const options = {
    body: String(data.body || "لديك تحديث جديد."),
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: String(data.tag || "mersalo-notification"),
    data: { url: String(data.url || "/"), type: String(data.type || "general") },
    renotify: true,
    silent: false,
    requireInteraction: isCall,
    vibrate: isCall ? [400, 200, 400, 200, 700, 300, 700] : [120],
    actions: isCall ? [
      { action: "answer", title: "فتح مِرسالو للرد" },
      { action: "dismiss", title: "إغلاق الإشعار" }
    ] : []
  };
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (data.type !== "pushTest" && windows.some(client => client.visibilityState === "visible")) return;
    await self.registration.showNotification(title, options);
  })());
});
self.addEventListener("notificationclick", event => {
  const notification = event.notification;
  const action = event.action;
  notification.close();
  if (action === "dismiss") return;
  const target = new URL(notification.data && notification.data.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
