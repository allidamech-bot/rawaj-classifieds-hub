import { Bell, Check, ChevronLeft, LoaderCircle, Rocket, Share2 } from "lucide-react";
import type { NotificationItem } from "@/lib/classifieds-types";
import { queueListingSharePrompt } from "@/lib/listing-share-growth";
import { queueSearchBoostIntent } from "@/lib/search-boost-growth";
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
  const approvedListingId =
    notification.type === "listing.approved" &&
    notification.targetType === "owner_listing" &&
    notification.targetId
      ? notification.targetId
      : null;
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
      {approvedListingId ? (
        <div className="flex flex-wrap gap-2 px-3 pb-3 sm:px-4">
          <button
            type="button"
            onClick={() => queueListingSharePrompt(approvedListingId)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            {text("مشاركة", "Share")}
          </button>
          <button
            type="button"
            onClick={() => queueSearchBoostIntent(approvedListingId)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-500/12 px-3 py-2 text-xs font-black text-amber-900 hairline dark:text-amber-100"
          >
            <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            {text("Boost · عملاء أكثر", "Boost · more customers")}
          </button>
        </div>
      ) : null}
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
