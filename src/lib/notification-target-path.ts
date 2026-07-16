export type NotificationTargetReference =
  | { kind: "listing"; id: string }
  | { kind: "conversation"; id: string }
  | { kind: "seller"; id: string }
  | { kind: "saved_search"; id: string };

export function parseNotificationTargetReference(
  targetType: unknown,
  targetId: unknown,
): NotificationTargetReference | null {
  const type = typeof targetType === "string" ? targetType.trim().toLowerCase() : "";
  const id = typeof targetId === "string" ? targetId.trim() : "";
  if (!type || !id) return null;

  if (type === "listing") return { kind: "listing", id };
  if (type === "conversation" || type === "chat") return { kind: "conversation", id };
  if (type === "seller") return { kind: "seller", id };
  if (type === "saved_search") return { kind: "saved_search", id };
  return null;
}

export function notificationTargetReferencePath(reference: NotificationTargetReference): string {
  const encodedId = encodeURIComponent(reference.id);
  if (reference.kind === "listing") return `/listings/${encodedId}`;
  if (reference.kind === "conversation") return `/chats?conversation=${encodedId}`;
  if (reference.kind === "seller") return `/seller/${encodedId}`;
  return "/saved-searches";
}

export function resolveNotificationTargetPath(
  targetType: unknown,
  targetId: unknown,
  fallback = "/notifications",
): string {
  const reference = parseNotificationTargetReference(targetType, targetId);
  return reference ? notificationTargetReferencePath(reference) : fallback;
}
