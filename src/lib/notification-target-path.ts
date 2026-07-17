import {
  normalizeNotificationId,
  normalizeNotificationTargetType,
} from "@/lib/notification-integrity";

export type NotificationTargetReference =
  | { kind: "listing"; id: string }
  | { kind: "conversation"; id: string }
  | { kind: "seller"; id: string }
  | { kind: "saved_search"; id: string }
  | { kind: "owner_listing"; id: string }
  | { kind: "support"; id: string }
  | { kind: "verification"; id: string }
  | { kind: "promotion"; id: string };

export function parseNotificationTargetReference(
  targetType: unknown,
  targetId: unknown,
): NotificationTargetReference | null {
  const kind = normalizeNotificationTargetType(targetType);
  const id = normalizeNotificationId(targetId);
  if (!kind || !id) return null;
  return { kind, id } as NotificationTargetReference;
}

export function notificationTargetReferencePath(reference: NotificationTargetReference): string {
  const encodedId = encodeURIComponent(reference.id);
  if (reference.kind === "listing") return `/listings/${encodedId}`;
  if (reference.kind === "conversation") return `/chats?conversation=${encodedId}`;
  if (reference.kind === "seller") return `/seller/${encodedId}`;
  if (reference.kind === "owner_listing") return `/profile/listings/${encodedId}`;
  if (reference.kind === "saved_search") return "/saved-searches";
  if (reference.kind === "support") return "/support";
  if (reference.kind === "verification") return "/verification";
  return "/promotion";
}

export function notificationOpenPath(notificationId: unknown): string {
  const id = normalizeNotificationId(notificationId);
  return id ? `/notifications?open=${encodeURIComponent(id)}` : "/notifications";
}

/** Legacy display-only path helper. Authorization-sensitive taps must use notificationOpenPath. */
export function resolveNotificationTargetPath(
  targetType: unknown,
  targetId: unknown,
  fallback = "/notifications",
): string {
  const reference = parseNotificationTargetReference(targetType, targetId);
  return reference ? notificationTargetReferencePath(reference) : fallback;
}
