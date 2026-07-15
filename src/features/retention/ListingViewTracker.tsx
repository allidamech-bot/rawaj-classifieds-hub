import { useEffect, useRef } from "react";
import { recordRecentListingView, syncAnonymousRecentListingViews } from "@/lib/classifieds-api";
import { useAuth } from "@/lib/use-auth";

interface ListingViewTrackerProps {
  listingId: string;
}

export function ListingViewTracker({ listingId }: ListingViewTrackerProps) {
  const auth = useAuth();
  const recordedViewKeyRef = useRef("");

  useEffect(() => {
    const cleanListingId = listingId.trim();
    if (!cleanListingId || auth.status === "loading" || typeof window === "undefined") return;

    const userId = auth.profile?.id ?? auth.user?.id ?? null;
    const recordKey = `${userId ?? "guest"}:${cleanListingId}`;
    if (recordedViewKeyRef.current === recordKey) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (userId) await syncAnonymousRecentListingViews(userId);
        const result = await recordRecentListingView(userId, cleanListingId);
        if (result.ok) recordedViewKeyRef.current = recordKey;
      })();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [auth.profile?.id, auth.status, auth.user?.id, listingId]);

  return null;
}
