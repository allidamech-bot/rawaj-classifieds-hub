import { readFile, rm, writeFile } from "node:fs/promises";

async function transform(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`${path}: transformation made no changes`);
  await writeFile(path, next);
}
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, pattern, replacement, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const count = [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(pattern, replacement);
}

await transform("src/routes/activity.tsx", (initial) => {
  let source = initial;
  source = replaceRegexOnce(
    source,
    /  const loadNotifications = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId\]\);/,
    `  const loadNotifications = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++notificationRequestIdRef.current;
    setNotificationsLoading(true);
    setNotificationError(null);
    try {
      const result = await fetchMyNotificationsPage({ limit: 8 });
      if (
        requestId !== notificationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) return;

      if (result.ok) {
        setNotifications((current) => mergeNotifications(current, result.data.items));
        setLoadedProfileId(currentProfileId);
        setHasLoadedNotifications(true);
      } else {
        setNotificationError(result.error);
      }
    } catch (caught) {
      if (
        requestId === notificationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setNotificationError({
          code: "unknown",
          message: caught instanceof Error ? caught.message : text("تعذر تحميل الإشعارات.", "Could not load notifications."),
          operation: "activity_notifications_load",
        });
      }
    } finally {
      if (
        requestId === notificationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) setNotificationsLoading(false);
    }
  }, [profileId, text]);`,
    "activity notification lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  const loadConversations = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[profileId\]\);/,
    `  const loadConversations = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++conversationRequestIdRef.current;
    setConversationsLoading(true);
    setConversationError(null);
    try {
      const result = await fetchMyConversations();
      if (
        requestId !== conversationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      ) return;

      if (result.ok) {
        setConversations(result.data.slice(0, 8));
        setHasLoadedConversations(true);
      } else {
        setConversationError(result.error);
      }
    } catch (caught) {
      if (
        requestId === conversationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setConversationError({
          code: "unknown",
          message: caught instanceof Error ? caught.message : text("تعذر تحميل المحادثات.", "Could not load conversations."),
          operation: "activity_conversations_load",
        });
      }
    } finally {
      if (
        requestId === conversationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) setConversationsLoading(false);
    }
  }, [profileId, text]);`,
    "activity conversation lifecycle",
  );
  return source;
});

await transform("src/routes/offers.tsx", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    `import { createFileRoute, Link, useRouter } from "@tanstack/react-router";`,
    `import { createFileRoute, Link, useRouter } from "@tanstack/react-router";\nimport { useRef, useState } from "react";`,
    "offers react state import",
  );
  source = replaceOnce(
    source,
    `  const { offers, error } = Route.useLoaderData();`,
    `  const { offers, error } = Route.useLoaderData();\n  const [retrying, setRetrying] = useState(false);\n  const retryInFlightRef = useRef(false);\n\n  async function retryOffers() {\n    if (retryInFlightRef.current) return;\n    retryInFlightRef.current = true;\n    setRetrying(true);\n    try {\n      await router.invalidate();\n    } finally {\n      retryInFlightRef.current = false;\n      setRetrying(false);\n    }\n  }`,
    "offers retry lifecycle",
  );
  source = replaceOnce(
    source,
    `                 onAction={() => void router.invalidate()}\n               />`,
    `                 onAction={() => void retryOffers()}\n                 actionDisabled={retrying}\n               />`,
    "offers retry binding",
  );
  source = replaceOnce(
    source,
    `  onAction,\n}: {\n  title: string;\n  body?: string;\n  actionLabel?: string;\n  onAction?: () => void;\n})`,
    `  onAction,\n  actionDisabled = false,\n}: {\n  title: string;\n  body?: string;\n  actionLabel?: string;\n  onAction?: () => void;\n  actionDisabled?: boolean;\n})`,
    "offers state disabled prop",
  );
  source = replaceOnce(
    source,
    `           onClick={onAction}\n           className=`,
    `           onClick={onAction}\n           disabled={actionDisabled}\n           aria-busy={actionDisabled}\n           className=`,
    "offers retry disabled",
  );
  return source;
});

await transform("src/routes/profile/listings.tsx", (initial) => {
  let source = initial;
  source = replaceRegexOnce(
    source,
    /  const loadListings = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[auth\.profile\?\.id, profileId\]\);/,
    `  const loadListings = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setListings(result.data);
        setListingsHasLoaded(true);
      } else setListingsError(result.error);
    } catch (caught) {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setListingsError({
          code: "unknown",
          message: caught instanceof Error ? caught.message : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
          operation: "owner_listings_load",
        });
      }
    } finally {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) setListingsLoading(false);
    }
  }, [profileId, text]);`,
    "owner listings load lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  const loadSellerProfile = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[auth\.profile\?\.id, profileId\]\);/,
    `  const loadSellerProfile = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++sellerRequestIdRef.current;
    setSellerLoading(true);
    setSellerError(null);
    try {
      const result = await fetchPublicSellerProfile(currentProfileId);
      if (requestId !== sellerRequestIdRef.current || currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setSellerProfile(result.data);
        setSellerHasLoaded(true);
      } else setSellerError(result.error);
    } catch (caught) {
      if (requestId === sellerRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setSellerError({
          code: "unknown",
          message: caught instanceof Error ? caught.message : text("تعذر تحميل بيانات المتجر.", "Could not load store details."),
          operation: "owner_store_load",
        });
      }
    } finally {
      if (requestId === sellerRequestIdRef.current && currentProfileId === profileIdRef.current) setSellerLoading(false);
    }
  }, [profileId, text]);`,
    "owner seller load lifecycle",
  );
  source = replaceOnce(
    source,
    `  const [expiryOption, setExpiryOption] = useState<ListingExpiryOption>(\n    listing.expiryDays ?? "never",\n  );`,
    `  const [expiryOption, setExpiryOption] = useState<ListingExpiryOption>(\n    listing.expiryDays ?? "never",\n  );\n  const deleteInFlightRef = useRef(false);\n  const lifecycleInFlightRef = useRef(false);\n  const reservationInFlightRef = useRef(false);\n  const priceDropInFlightRef = useRef(false);`,
    "owner card action refs",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleConfirmDelete\(\) \{[\s\S]*?\n  \}\n\n  async function handleClose/,
    `  async function handleConfirmDelete() {
    if (deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeleteError("");
    setDeleting(true);
    try {
      const result = await deleteOwnerListing(userId, listing.id);
      if (!result.ok) {
        setDeleteError(result.error.message);
        return;
      }
      setShowDeleteConfirm(false);
      onDeleted(userId, listing.id);
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : text("تعذر حذف الإعلان.", "Could not delete the listing."));
    } finally {
      deleteInFlightRef.current = false;
      setDeleting(false);
    }
  }

  async function handleClose`,
    "owner delete lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleClose\(targetStatus: OwnerCloseListingStatus\) \{[\s\S]*?\n  \}\n\n  async function handleReservationToggle/,
    `  async function handleClose(targetStatus: OwnerCloseListingStatus) {
    if (lifecycleInFlightRef.current) return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await closeOwnerListing(userId, listing.id, targetStatus);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setLifecycleError(caught instanceof Error ? caught.message : text("تعذر تحديث حالة الإعلان.", "Could not update listing status."));
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  async function handleReservationToggle`,
    "owner close lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleReservationToggle\(\) \{[\s\S]*?\n  \}\n\n  async function handlePriceDrop/,
    `  async function handleReservationToggle() {
    if (reservationInFlightRef.current || !canManageReservation) return;
    reservationInFlightRef.current = true;
    setReservationError("");
    setReservationBusy(true);
    try {
      const result = await setOwnerListingReserved(userId, listing.id, !listing.reservedAt);
      if (!result.ok) {
        setReservationError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setReservationError(caught instanceof Error ? caught.message : text("تعذر تحديث حالة الحجز.", "Could not update reservation status."));
    } finally {
      reservationInFlightRef.current = false;
      setReservationBusy(false);
    }
  }

  async function handlePriceDrop`,
    "owner reservation lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handlePriceDrop\(\) \{[\s\S]*?\n  \}\n\n  async function handleReactivate/,
    `  async function handlePriceDrop() {
    if (priceDropInFlightRef.current || !canReducePrice) return;
    const nextPrice = Number(priceDropDraft);
    setPriceDropError("");
    if (!Number.isFinite(nextPrice) || nextPrice <= 0 || (listing.price !== null && nextPrice >= listing.price)) {
      setPriceDropError(text("أدخل سعراً جديداً أقل من السعر الحالي.", "Enter a valid price lower than the current price."));
      return;
    }
    priceDropInFlightRef.current = true;
    setPriceDropBusy(true);
    try {
      const result = await reduceOwnerListingPrice(userId, listing.id, nextPrice);
      if (!result.ok) {
        setPriceDropError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setPriceDropError(caught instanceof Error ? caught.message : text("تعذر خفض السعر.", "Could not reduce the price."));
    } finally {
      priceDropInFlightRef.current = false;
      setPriceDropBusy(false);
    }
  }

  async function handleReactivate`,
    "owner price lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleReactivate\(\) \{[\s\S]*?\n  \}\n\n  async function handleExpiryUpdate/,
    `  async function handleReactivate() {
    if (lifecycleInFlightRef.current) return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await reactivateOwnerListing(userId, listing.id);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setLifecycleError(caught instanceof Error ? caught.message : text("تعذر إعادة تفعيل الإعلان.", "Could not reactivate the listing."));
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  async function handleExpiryUpdate`,
    "owner reactivate lifecycle",
  );
  source = replaceRegexOnce(
    source,
    /  async function handleExpiryUpdate\(\) \{[\s\S]*?\n  \}\n\n  const lockedMessage/,
    `  async function handleExpiryUpdate() {
    if (lifecycleInFlightRef.current || listing.status !== "approved") return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await setOwnerListingExpiry(userId, listing.id, expiryOption);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setLifecycleError(caught instanceof Error ? caught.message : text("تعذر تحديث مدة الإعلان.", "Could not update listing expiry."));
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  const lockedMessage`,
    "owner expiry lifecycle",
  );
  return source;
});

await rm("scripts/apply-final-public-operations-integrity.mjs", { force: true });
