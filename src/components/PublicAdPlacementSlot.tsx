import { useEffect, useState } from "react";

import type { AdPlacementPage } from "@/lib/api/ad-placements";
import {
  fetchActiveAdPlacements,
  onAdPlacementInvalidation,
  refreshActiveAdPlacements,
  type AdPlacementDevice,
  type PublicAdPlacement,
} from "@/lib/api/public-ad-placements";
import { useUiPreferences } from "@/lib/ui-preferences";

interface Props {
  placementPage: AdPlacementPage | null;
}

interface LoadedPlacement {
  page: AdPlacementPage;
  device: AdPlacementDevice;
  placement: PublicAdPlacement | null;
}

const MOBILE_PLACEMENT_QUERY = "(max-width: 767px)";
const AD_PLACEMENT_RETRY_BASE_MS = 2_000;
const AD_PLACEMENT_RETRY_MAX_MS = 15_000;
const AD_PLACEMENT_RETRY_LIMIT = 3;
const AD_PLACEMENT_FRESHNESS_REFRESH_MS = 5 * 60_000;
const AD_PLACEMENT_FRAME_CLASS =
  "relative block aspect-[16/7] w-full overflow-hidden rounded-[1.25rem] border border-border/70 bg-card";

function resolvePlacementDevice(mediaQuery: MediaQueryList): AdPlacementDevice {
  return mediaQuery.matches ? "mobile" : "desktop";
}

function readInitialPlacementDevice(): AdPlacementDevice | null {
  if (typeof window === "undefined") return null;
  return resolvePlacementDevice(window.matchMedia(MOBILE_PLACEMENT_QUERY));
}

export function PublicAdPlacementSlot({ placementPage }: Props) {
  const { text } = useUiPreferences();
  const [device, setDevice] = useState<AdPlacementDevice | null>(readInitialPlacementDevice);
  const [loaded, setLoaded] = useState<LoadedPlacement | null>(null);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_PLACEMENT_QUERY);
    const syncDevice = () => setDevice(resolvePlacementDevice(mediaQuery));

    mediaQuery.addEventListener("change", syncDevice);
    return () => mediaQuery.removeEventListener("change", syncDevice);
  }, []);

  useEffect(() => {
    if (!placementPage || !device) return;

    const page: AdPlacementPage = placementPage;
    const activeDevice: AdPlacementDevice = device;
    let cancelled = false;
    let requestSequence = 0;
    let retryAttempt = 0;
    let retryTimer: number | null = null;
    let freshnessTimer: number | null = null;

    function clearRetryTimer() {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }

    function clearFreshnessTimer() {
      if (freshnessTimer === null) return;
      window.clearTimeout(freshnessTimer);
      freshnessTimer = null;
    }

    function scheduleFreshnessRefresh() {
      if (cancelled || freshnessTimer !== null) return;
      freshnessTimer = window.setTimeout(() => {
        freshnessTimer = null;
        if (cancelled || document.visibilityState === "hidden" || navigator.onLine === false) {
          return;
        }
        retryAttempt = 0;
        clearRetryTimer();
        load(true);
      }, AD_PLACEMENT_FRESHNESS_REFRESH_MS);
    }

    function scheduleRetry() {
      if (
        cancelled ||
        retryTimer !== null ||
        retryAttempt >= AD_PLACEMENT_RETRY_LIMIT ||
        navigator.onLine === false
      ) {
        return;
      }
      const delay = Math.min(
        AD_PLACEMENT_RETRY_MAX_MS,
        AD_PLACEMENT_RETRY_BASE_MS * 2 ** retryAttempt,
      );
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        load();
      }, delay);
    }

    function load(forceRefresh = false) {
      if (cancelled || document.visibilityState === "hidden") return;
      const requestId = ++requestSequence;
      const request = forceRefresh
        ? refreshActiveAdPlacements(page, activeDevice)
        : fetchActiveAdPlacements(page, activeDevice);

      void request.then((result) => {
        if (cancelled || requestId !== requestSequence) return;
        if (!result.ok) {
          scheduleRetry();
          return;
        }

        clearRetryTimer();
        retryAttempt = 0;
        setFailedImageUrl(null);
        setLoaded({
          page,
          device: activeDevice,
          placement: result.data[0] ?? null,
        });
        scheduleFreshnessRefresh();
      });
    }

    const refreshWhenAvailable = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false) return;
      retryAttempt = 0;
      clearRetryTimer();
      load();
    };

    load();
    const unsubscribe = onAdPlacementInvalidation(refreshWhenAvailable);
    window.addEventListener("online", refreshWhenAvailable);
    document.addEventListener("visibilitychange", refreshWhenAvailable);

    return () => {
      cancelled = true;
      requestSequence += 1;
      clearRetryTimer();
      clearFreshnessTimer();
      window.removeEventListener("online", refreshWhenAvailable);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      unsubscribe();
    };
  }, [device, placementPage]);

  if (!placementPage || !device) return null;

  const hasResolvedCurrentPlacement = loaded?.page === placementPage && loaded.device === device;
  if (!hasResolvedCurrentPlacement) return null;

  const placement = loaded.placement;
  if (!placement || failedImageUrl === placement.imageUrl) return null;

  return (
    <aside
      className="rawaj-ad-placement container-wide mt-3"
      aria-label={text("مساحة إعلانية", "Advertisement")}
      data-placement-page={placementPage}
      data-placement-device={device}
      data-placement-loading="false"
    >
      <a
        href={placement.destinationUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`${AD_PLACEMENT_FRAME_CLASS} group transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5`}
      >
        <span className="rawaj-ad-placement__label absolute start-2 top-2 z-10 rounded-full px-2 py-1 text-[10px] font-bold backdrop-blur-sm">
          {text("إعلان", "Ad")}
        </span>
        <img
          src={placement.imageUrl}
          alt={text("إعلان ترويجي", "Promotional advertisement")}
          loading={placementPage === "home" ? "eager" : "lazy"}
          decoding="async"
          width={1600}
          height={700}
          draggable={false}
          key={`${placement.id}:${placement.imageUrl}:${device}`}
          onError={() => setFailedImageUrl(placement.imageUrl)}
          className="h-full w-full object-cover"
        />
      </a>
    </aside>
  );
}
