import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
import type { ListingImage } from "@/lib/classifieds-types";

const SWIPE_THRESHOLD_PX = 42;

export function useListingMediaState(images: ListingImage[]) {
  const visibleImages = useMemo(() => images.filter((image) => image.publicUrl), [images]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
    setLoadedUrl(null);
  }, [images]);

  const goTo = useCallback(
    (index: number) => {
      if (visibleImages.length === 0) return;
      const next = (index + visibleImages.length) % visibleImages.length;
      setSelectedIndex(next);
      setLoadedUrl(null);
    },
    [visibleImages.length],
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      if (touchStartX.current === null) return;
      const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
      const delta = endX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
      goTo(selectedIndex + (delta < 0 ? 1 : -1));
    },
    [goTo, selectedIndex],
  );

  const selectedImage = visibleImages[selectedIndex] ?? visibleImages[0] ?? null;
  const selectedUrl = selectedImage?.publicUrl ?? null;

  return {
    visibleImages,
    selectedIndex,
    selectedImage,
    selectedUrl,
    loadedUrl,
    setLoadedUrl,
    viewerOpen,
    setViewerOpen,
    goTo,
    handleTouchStart,
    handleTouchEnd,
  };
}
