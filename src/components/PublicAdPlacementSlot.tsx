import { useEffect, useMemo, useState } from "react";

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
  placements: PublicAdPlacement[];
}

const MOBILE_PLACEMENT_QUERY = "(max-width: 767px)";
const AD_PLACEMENT_RETRY_BASE_MS = 2_000;
const AD_PLACEMENT_RETRY_MAX_MS = 15_000;
const AD_PLACEMENT_RETRY_LIMIT = 3;
const AD_PLACEMENT_FRESHNESS_REFRESH_MS = 5 * 60_000;
const AD_PLACEMENT_FRAME_CLASS =
  "rawaj-ad-placement__frame group relative block w-full overflow-hidden rounded-[1.25rem] border transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5";

function resolvePlacementDevice(mediaQuery: MediaQueryList): AdPlacementDevice {
  return mediaQuery.matches ? "mobile" : "desktop";
}

function readInitialPlacementDevice(): AdPlacementDevice | null {
  if (typeof window === "undefined") return null;
  return resolvePlacementDevice(window.matchMedia(MOBILE_PLACEMENT_QUERY));
}

function uniquePlacements(placements: PublicAdPlacement[]): PublicAdPlacement[] {
  const seen = new Set<string>();
  return placements.filter((placement) => {
    const identity = `${placement.id}:${placement.imageUrl}:${placement.destinationUrl}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export function PublicAdPlacementSlot({ placementPage }: Props) {
  const { text } = useUiPreferences();
  const [device, setDevice] = useState<AdPlacementDevice | null>(readInitialPlacementDevice);
  const [loaded, setLoaded] = useState<LoadedPlacement | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());

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
        setFailedImageUrls(new Set());
        setLoaded({
          page,
          device: activeDevice,
          placements: uniquePlacements(result.data),
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
    window.addEventListener("focus", refreshWhenAvailable);
    document.addEventListener("visibilitychange", refreshWhenAvailable);

    return () => {
      cancelled = true;
      requestSequence += 1;
      clearRetryTimer();
      clearFreshnessTimer();
      window.removeEventListener("online", refreshWhenAvailable);
      window.removeEventListener("focus", refreshWhenAvailable);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      unsubscribe();
    };
  }, [device, placementPage]);

  const visiblePlacements = useMemo(() => {
    if (!placementPage || !device) return [];
    if (loaded?.page !== placementPage || loaded.device !== device) return [];

    const maximum = placementPage === "home" ? 2 : 1;
    return loaded.placements
      .filter((placement) => !failedImageUrls.has(placement.imageUrl))
      .slice(0, maximum);
  }, [device, failedImageUrls, loaded, placementPage]);

  if (!placementPage || !device || visiblePlacements.length === 0) return null;

  function markImageFailed(imageUrl: string) {
    setFailedImageUrls((current) => {
      if (current.has(imageUrl)) return current;
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  }

  return (
    <aside
      className="rawaj-ad-placement container-wide"
      aria-label={text("مساحات إعلانية", "Advertisements")}
      data-placement-page={placementPage}
      data-placement-device={device}
      data-placement-loading="false"
      data-placement-count={visiblePlacements.length}
    >
      <div className="rawaj-ad-placement__grid" data-count={visiblePlacements.length}>
        {visiblePlacements.map((placement, index) => (
          <a
            key={`${placement.id}:${placement.imageUrl}:${device}`}
            href={placement.destinationUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={AD_PLACEMENT_FRAME_CLASS}
          >
            <img
              src={placement.imageUrl}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              draggable={false}
              className="rawaj-ad-placement__backdrop"
            />
            <img
              src={placement.imageUrl}
              alt={text("إعلان ترويجي", "Promotional advertisement")}
              loading={placementPage === "home" && index === 0 ? "eager" : "lazy"}
              fetchPriority={placementPage === "home" && index === 0 ? "high" : "auto"}
              decoding="async"
              width={1600}
              height={700}
              draggable={false}
              onError={() => markImageFailed(placement.imageUrl)}
              className="rawaj-ad-placement__image"
            />
            <span className="rawaj-ad-placement__scrim" aria-hidden="true" />
            <span className="rawaj-ad-placement__label absolute start-2 top-2 rounded-full px-2 py-1 text-[10px] font-bold backdrop-blur-sm">
              {text("إعلان", "Ad")}
            </span>
          </a>
        ))}
      </div>
    </aside>
  );
}
