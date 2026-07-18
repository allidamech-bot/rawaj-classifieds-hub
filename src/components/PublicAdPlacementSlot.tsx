import { useEffect, useState } from "react";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import {
  fetchActiveAdPlacements,
  onAdPlacementInvalidation,
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

    function load() {
      if (cancelled) return;
      const requestId = ++requestSequence;

      void fetchActiveAdPlacements(page, activeDevice).then((result) => {
        if (cancelled || requestId !== requestSequence) return;
        setFailedImageUrl(null);
        setLoaded({
          page,
          device: activeDevice,
          placement: result.ok ? (result.data[0] ?? null) : null,
        });
      });
    }

    load();
    const unsubscribe = onAdPlacementInvalidation(load);

    return () => {
      cancelled = true;
      requestSequence += 1;
      unsubscribe();
    };
  }, [device, placementPage]);

  const placement =
    loaded?.page === placementPage && loaded.device === device ? loaded.placement : null;
  if (!placementPage || !device || !placement || failedImageUrl === placement.imageUrl) return null;

  return (
    <aside
      className="container-wide mt-3"
      aria-label={text("مساحة إعلانية", "Advertisement")}
      data-placement-page={placementPage}
      data-placement-device={device}
    >
      <a
        href={placement.destinationUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="group relative block overflow-hidden rounded-[1.25rem] border border-border/70 bg-card shadow-[0_12px_32px_rgba(8,24,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(8,24,42,0.12)]"
      >
        <span className="absolute start-2 top-2 z-10 rounded-full bg-primary/88 px-2 py-1 text-[9px] font-bold text-primary-foreground backdrop-blur-sm">
          {text("إعلان", "Ad")}
        </span>
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
          className="aspect-[16/7] w-full object-cover"
        />
      </a>
    </aside>
  );
}
