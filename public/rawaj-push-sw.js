/* global self */
// Push-only worker: never intercept, redirect or cache marketplace requests.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeId(value) {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function target(data) {
  const conversation = safeId(data?.conversation_id);
  const notification = safeId(data?.notification_id);
  if (conversation) return "/chats?conversation=" + encodeURIComponent(conversation);
  if (notification) return "/notifications?open=" + encodeURIComponent(notification);
  return "/notifications";
}

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json()?.data ?? {};
  } catch {
    // Always display a generic visible notification for Safari Web Push.
  }
  const english = data.language === "en";
  event.waitUntil(
    self.registration.showNotification(english ? "Rawaj" : "رواج", {
      body: english ? "You have a new update." : "لديك تحديث جديد.",
      icon: "/brand/rawaj-mark-transparent-192.png",
      tag: safeId(data.event_id) ?? "rawaj-update",
      data: {
        conversation_id: safeId(data.conversation_id),
        notification_id: safeId(data.notification_id),
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(target(event.notification.data), self.location.origin).href;
  event.waitUntil(self.clients.openWindow(url));
});
