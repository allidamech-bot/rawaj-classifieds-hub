import { useEffect, useState } from "react";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import {
  fetchActiveAdPlacements,
  type AdPlacementDevice,
  type PublicAdPlacement,
} from "@/lib/api/public-ad-placements";
import { useUiPreferences } from "@/lib/ui-preferences";

interface Props {
  placementPage: AdPlacementPage | null;
}

interface LoadedPlacement {
  page: AdPlacementPage;
  placement: PublicAdPlacement | null;
}

export function PublicAdPlacementSlot({ placementPage }: Props) {
  const { text } = useUiPreferences();
  const [loaded, setLoaded] = useState<LoadedPlacement | null>(null);

  useEffect(() => {
    if (!placementPage) return;

    let cancelled = false;
    const device: AdPlacementDevice = window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop";

    void fetchActiveAdPlacements(placementPage, device).then((result) => {
      if (cancelled) return;
      setLoaded({
        page: placementPage,
        placement: result.ok ? (result.data[0] ?? null) : null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [placementPage]);

  const placement = loaded?.page === placementPage ? loaded.placement : null;
  if (!placementPage || !placement) return null;

  return (
    <aside
      className="container-wide mt-3"
      aria-label={text("مساحة إعلانية", "Advertisement")}
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
          loading="lazy"
          decoding="async"
          className="aspect-[3.2/1] w-full object-cover sm:aspect-[5/1]"
        />
      </a>
    </aside>
  );
}
