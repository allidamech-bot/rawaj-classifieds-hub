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
const AD_PLACEMENT_SCHEDULE_REFRESH_MS = 30_000;
const AD_PLACEMENT_RETRY_BASE_MS = 1_500;
const AD_PLACEMENT_RETRY_MAX_MS = 30_000;
const AD_PLACEMENT_FRAME_CLASS =
  "relative block aspect-[16/7] w-full overflow-hidden rounded-[1.25rem] border border-border/70 bg-card shadow-[0_12px_32px_rgba(8,24,42,0.08)]";

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

    function clearRetryTimer() {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }

    function scheduleRetry() {
      if (cancelled || retryTimer !== null) return;
      const delay = Math.min(
        AD_PLACEMENT_RETRY_MAX_MS,
        AD_PLACEMENT_RETRY_BASE_MS * 2 ** retryAttempt,
      );
      retryAttempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        load(true);
      }, delay);
    }

    function load(forceRefresh = false) {
      if (cancelled) return;
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
      });
    }

    load();
    const unsubscribe = onAdPlacementInvalidation(() => load());
    const scheduleRefreshTimer = window.setInterval(
      () => load(true),
      AD_PLACEMENT_SCHEDULE_REFRESH_MS,
    );

    return () => {
      cancelled = true;
      requestSequence += 1;
      clearRetryTimer();
      window.clearInterval(scheduleRefreshTimer);
      unsubscribe();
    };
  }, [device, placementPage]);

  if (!placementPage) return null;

  const hasResolvedCurrentPlacement = loaded?.page === placementPage && loaded.device === device;
  if (!device || !hasResolvedCurrentPlacement) {
    return (
      <aside
        className="container-wide mt-3"
        aria-hidden="true"
        data-placement-page={placementPage}
        data-placement-loading="true"
      >
        <div className={`${AD_PLACEMENT_FRAME_CLASS} rawaj-ad-placement-skeleton`} />
      </aside>
    );
  }

  const placement = loaded.placement;
  if (!placement) return null;

  const imageFailed = failedImageUrl === placement.imageUrl;

  return (
    <aside
      className="container-wide mt-3"
      aria-label={text("مساحة إعلانية", "Advertisement")}
      data-placement-page={placementPage}
      data-placement-device={device}
      data-placement-loading="false"
    >
      <a
        href={placement.destinationUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`${AD_PLACEMENT_FRAME_CLASS} group transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(8,24,42,0.12)]`}
      >
        <span className="absolute start-2 top-2 z-10 rounded-full bg-primary/88 px-2 py-1 text-[9px] font-bold text-primary-foreground backdrop-blur-sm">
          {text("إعلان", "Ad")}
        </span>
        {imageFailed ? (
          <span className="grid h-full w-full place-items-center bg-muted-surface px-6 text-center text-sm font-bold text-muted-foreground">
            {text("إعلان ترويجي", "Promotional advertisement")}
          </span>
        ) : (
          <img
            src={placement.imageUrl}
            alt={text("إعلان ترويجي", "Promotional advertisement")}
            loading="eager"
            decoding="async"
            width={1600}
            height={700}
            draggable={false}
            key={`${placement.id}:${placement.imageUrl}:${device}`}
            onError={() => setFailedImageUrl(placement.imageUrl)}
            className="h-full w-full object-cover"
          />
        )}
      </a>
    </aside>
  );
}
