import { readFile, rm, writeFile } from "node:fs/promises";

const path = "src/routes/notifications.tsx";
let source = await readFile(path, "utf8");

function replaceRegexOnce(pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  source = source.replace(pattern, replacement);
}

replaceRegexOnce(
  /  const loadNotifications = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[applyKnownReadState, counts\.notifications, profileId, text\]\);/,
  `  const loadNotifications = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++notificationsRequestIdRef.current;
    paginationRequestIdRef.current += 1;
    loadMoreInFlightRef.current = false;
    setLoading(true);
    setLoadingMore(false);
    setLoadError(null);
    setPaginationError(null);
    setActionMessage(null);

    try {
      const [pageResult, unreadResult] = await Promise.all([
        fetchMyNotificationsPage({ limit: NOTIFICATIONS_PAGE_SIZE }),
        fetchUnreadNotificationsCount(),
      ]);

      if (
        requestId !== notificationsRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) {
        return;
      }
      if (!pageResult.ok) {
        setLoadError(pageResult.error);
        setUnreadCountExact(false);
        return;
      }

      const nextItems = applyKnownReadState(pageResult.data.items);
      const loadedUnread = nextItems.filter((item) => !item.readAt).length;
      setNotifications(nextItems);
      setHasLoaded(true);
      setHasMore(pageResult.data.hasMore);
      setNextCursor(pageResult.data.nextCursor);
      setUnreadCountExact(unreadResult.ok);
      setUnreadTotal(
        unreadResult.ok
          ? unreadResult.data
          : Math.max(
              loadedUnread,
              counts.notifications,
              pageResult.data.hasMore && loadedUnread === 0 ? 1 : 0,
            ),
      );
      if (!unreadResult.ok) {
        setActionMessage(
          text(
            "تعذر تحديث العدد الدقيق للتنبيهات، لكن يمكنك متابعة العناصر وقراءتها بشكل طبيعي.",
            "The exact unread count could not be refreshed, but notifications remain usable.",
          ),
        );
      }
    } catch (caught) {
      if (
        requestId !== notificationsRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) {
        return;
      }
      setUnreadCountExact(false);
      setLoadError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل التنبيهات.", "Could not load notifications."),
        operation: "notifications_load",
      });
    } finally {
      if (
        requestId === notificationsRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setLoading(false);
      }
    }
  }, [applyKnownReadState, counts.notifications, profileId, text]);`,
  "notifications initial load lifecycle",
);

replaceRegexOnce(
  /    void \(async \(\) => \{\n      const result = await fetchMyNotificationById\(notificationId\);[\s\S]*?\n    \}\)\(\);/,
  `    void (async () => {
      try {
        const result = await fetchMyNotificationById(notificationId);
        if (currentProfileId !== profileIdRef.current) return;
        void navigate({ to: "/notifications", search: {}, replace: true });
        if (!result.ok || !result.data) {
          setActionMessage(
            text(
              "تعذر فتح هذا التنبيه أو لم يعد متاحًا لهذا الحساب.",
              "This notification is unavailable for the current account.",
            ),
          );
          return;
        }
        setNotifications((current) =>
          applyKnownReadState(mergeNotifications(current, [result.data as NotificationItem])),
        );
        await openNotificationTargetRef.current(result.data as NotificationItem);
      } catch (caught) {
        if (currentProfileId !== profileIdRef.current) return;
        void navigate({ to: "/notifications", search: {}, replace: true });
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر فتح التنبيه.", "Could not open the notification."),
        );
      }
    })();`,
  "notification push open lifecycle",
);

replaceRegexOnce(
  /  async function loadMoreNotifications\(\) \{[\s\S]*?\n  \}\n\n  async function markOne/,
  `  async function loadMoreNotifications() {
    if (
      !profileId ||
      loading ||
      loadingMore ||
      loadMoreInFlightRef.current ||
      !hasMore ||
      !nextCursor
    ) {
      return;
    }
    const currentProfileId = profileId;
    const parentRequestId = notificationsRequestIdRef.current;
    const paginationRequestId = ++paginationRequestIdRef.current;
    const cursorSnapshot = nextCursor;
    loadMoreInFlightRef.current = true;
    setLoadingMore(true);
    setPaginationError(null);

    try {
      const result = await fetchMyNotificationsPage({
        cursor: cursorSnapshot,
        limit: NOTIFICATIONS_PAGE_SIZE,
      });
      if (
        parentRequestId !== notificationsRequestIdRef.current ||
        paginationRequestId !== paginationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) {
        return;
      }
      if (!result.ok) {
        setPaginationError(result.error);
        return;
      }
      const nextItems = applyKnownReadState(result.data.items);
      setNotifications((current) => mergeNotifications(current, nextItems));
      setHasMore(result.data.hasMore);
      setNextCursor(result.data.nextCursor);
    } catch (caught) {
      if (
        parentRequestId === notificationsRequestIdRef.current &&
        paginationRequestId === paginationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setPaginationError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل المزيد من التنبيهات.", "Could not load more notifications."),
          operation: "notifications_load_more",
        });
      }
    } finally {
      if (paginationRequestId === paginationRequestIdRef.current) {
        loadMoreInFlightRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  async function markOne`,
  "notification pagination lifecycle",
);

replaceRegexOnce(
  /  async function markOne\(notificationId: string\) \{[\s\S]*?\n  \}\n\n  async function markAll/,
  `  async function markOne(notificationId: string) {
    const currentProfileId = profileId;
    if (!currentProfileId) return false;
    const scopeKey = notificationActionScope(currentProfileId, notificationId);
    if (markingReadScopesRef.current.has(scopeKey)) return false;

    const wasUnread = notifications.some((item) => item.id === notificationId && !item.readAt);
    markingReadScopesRef.current.add(scopeKey);
    setMarkingReadIds((current) => new Set(current).add(notificationId));
    setActionMessage(null);
    try {
      const result = await markNotificationRead(notificationId);
      if (currentProfileId !== profileIdRef.current) return false;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return false;
      }
      readNotificationIdsRef.current.add(notificationId);
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, readAt } : item)),
      );
      if (wasUnread) setUnreadTotal((current) => Math.max(0, current - 1));
      void refreshUnreadActivity();
      return true;
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر تعليم التنبيه كمقروء.", "Could not mark the notification as read."),
        );
      }
      return false;
    } finally {
      markingReadScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setMarkingReadIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
    }
  }

  async function markAll`,
  "notification mark one lifecycle",
);

replaceRegexOnce(
  /  async function markAll\(\) \{[\s\S]*?\n  \}\n\n  async function openNotificationTarget/,
  `  async function markAll() {
    const currentProfileId = profileId;
    if (!currentProfileId || markingAllProfilesRef.current.has(currentProfileId)) return;

    markingAllProfilesRef.current.add(currentProfileId);
    setMarkingAll(true);
    setActionMessage(null);
    try {
      const result = await markAllNotificationsRead();
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      const readAt = result.data.cutoff;
      markAllReadAtRef.current = readAt;
      notifications
        .filter((item) => notificationIsWithinReadCutoff(item, readAt))
        .forEach((item) => readNotificationIdsRef.current.add(item.id));
      setNotifications((current) =>
        current.map((item) =>
          notificationIsWithinReadCutoff(item, readAt) ? { ...item, readAt } : item,
        ),
      );
      setUnreadTotal(
        notifications.filter(
          (item) => !item.readAt && !notificationIsWithinReadCutoff(item, readAt),
        ).length,
      );
      setUnreadCountExact(true);
      void refreshUnreadActivity();
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر تعليم جميع التنبيهات كمقروءة.", "Could not mark all notifications as read."),
        );
      }
    } finally {
      markingAllProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setMarkingAll(false);
    }
  }

  async function openNotificationTarget`,
  "notification mark all lifecycle",
);

replaceRegexOnce(
  /  async function openNotificationTarget\(notification: NotificationItem\) \{[\s\S]*?\n  \}\n\n  openNotificationTargetRef/,
  `  async function openNotificationTarget(notification: NotificationItem) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = notificationActionScope(currentProfileId, notification.id);
    if (openingTargetScopesRef.current.has(scopeKey)) return;

    openingTargetScopesRef.current.add(scopeKey);
    setOpeningTargetIds((current) => new Set(current).add(notification.id));
    setActionMessage(null);
    try {
      const result = await resolveNotificationTarget(notification.id);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      const target = result.data;
      if (!target) {
        if (!notification.readAt) {
          await markOne(notification.id);
          if (currentProfileId !== profileIdRef.current) return;
        }
        setActionMessage(
          text(
            "لم يعد الهدف المرتبط بهذا التنبيه متاحًا.",
            "The item linked to this notification is no longer available.",
          ),
        );
        return;
      }
      if (!notification.readAt) {
        await markOne(notification.id);
        if (currentProfileId !== profileIdRef.current) return;
      }
      if (target.kind === "listing") {
        await navigate({ to: "/listings/$id", params: { id: target.listingId } });
      } else if (target.kind === "owner_listing") {
        await navigate({ to: "/profile/listings/$id", params: { id: target.listingId } });
      } else if (target.kind === "conversation") {
        await navigate({ to: "/chats", search: { conversation: target.conversationId } });
      } else if (target.kind === "seller") {
        await navigate({ to: "/seller/$id", params: { id: target.sellerId } });
      } else if (target.kind === "saved_search") {
        await navigate({
          to: "/saved-searches",
          search: {
            taxonomy: "",
            q: "",
            category: "",
            subcategory: "",
            gov: "",
            district: "",
            price_min: "",
            price_max: "",
            price_type: "",
            condition: "",
            car_make: "",
            car_model: "",
            fuel: "",
            transmission: "",
            property_purpose: "",
            property_type: "",
            rooms: "",
            rental_duration: "",
            electronics_brand: "",
            detail_condition: "",
            employment_type: "",
            salary_type: "",
            sort: "latest",
          },
        });
      } else if (target.kind === "browse_listings") {
        await navigate({ to: "/listings" });
      } else if (target.kind === "support") {
        await navigate({ to: "/support" });
      } else if (target.kind === "verification") {
        await navigate({ to: "/verification" });
      } else if (target.kind === "promotion") {
        await navigate({ to: "/promotion" });
      }
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setActionMessage(
          caught instanceof Error
            ? caught.message
            : text("تعذر فتح هدف التنبيه.", "Could not open the notification target."),
        );
      }
    } finally {
      openingTargetScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setOpeningTargetIds((current) => {
          const next = new Set(current);
          next.delete(notification.id);
          return next;
        });
      }
    }
  }

  openNotificationTargetRef`,
  "notification target lifecycle",
);

await writeFile(path, source);
await rm("scripts/apply-notification-actions-integrity.mjs", { force: true });
