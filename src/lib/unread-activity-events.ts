export const UNREAD_ACTIVITY_CHANGED_EVENT = "rawaj:unread-activity-changed";

export function emitUnreadActivityChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UNREAD_ACTIVITY_CHANGED_EVENT));
}
