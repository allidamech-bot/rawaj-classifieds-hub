import { Bell, Check, ChevronLeft, LoaderCircle } from "lucide-react";
import type { NotificationItem } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function NotificationTimelineCard({
  notification,
  title,
  body,
  dateLabel,
  navigable,
  opening,
  markingRead,
  onOpen,
  onMarkRead,
}: {
  notification: NotificationItem;
  title: string;
  body: string | null;
  dateLabel: string;
  navigable: boolean;
  opening: boolean;
  markingRead: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const { text } = useUiPreferences();
  const content = (
    <>
      <span className="rawaj-notification-timeline__icon">
        <Bell aria-hidden="true" />
      </span>
      <span className="rawaj-notification-timeline__copy">
        <strong>{title}</strong>
        {body ? <p>{body}</p> : null}
        <small>{opening ? text("جارٍ فتح الهدف...", "Opening target...") : dateLabel}</small>
      </span>
      {navigable ? (
        opening ? (
          <LoaderCircle
            className="rawaj-notification-timeline__chevron animate-spin"
            aria-hidden="true"
          />
        ) : (
          <ChevronLeft
            className="rawaj-notification-timeline__chevron rtl:rotate-180"
            aria-hidden="true"
          />
        )
      ) : null}
    </>
  );

  return (
    <article className="rawaj-notification-timeline" data-read={Boolean(notification.readAt)}>
      {navigable ? (
        <button type="button" onClick={onOpen} disabled={opening}>
          {content}
        </button>
      ) : (
        <div>{content}</div>
      )}
      {!notification.readAt ? (
        <button
          type="button"
          className="rawaj-notification-timeline__read"
          onClick={onMarkRead}
          disabled={markingRead}
          aria-busy={markingRead}
        >
          {markingRead ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          {markingRead ? text("جارٍ التحديث", "Updating") : text("تحديد كمقروء", "Mark read")}
        </button>
      ) : null}
    </article>
  );
}
