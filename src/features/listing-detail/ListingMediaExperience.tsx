import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Maximize2, Share2 } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ListingImage } from "@/lib/classifieds-types";
import type { PlaceholderType } from "@/types";

const ListingMediaViewer = lazy(() => import("./ListingMediaViewer"));

interface ListingMediaExperienceProps {
  images: ListingImage[];
  title: string;
  placeholder: PlaceholderType;
  favorite: boolean;
  imageError?: string | null;
  onBack: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
  text: (ar: string, en: string) => string;
}

export function ListingMediaExperience({
  images,
  title,
  placeholder,
  favorite,
  imageError,
  onBack,
  onShare,
  onToggleFavorite,
  text,
}: ListingMediaExperienceProps) {
  const visibleImages = images.filter((image) => image.publicUrl);
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

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 42) return;
    goTo(selectedIndex + (delta < 0 ? 1 : -1));
  };

  const selectedImage = visibleImages[selectedIndex] ?? visibleImages[0] ?? null;
  const selectedUrl = selectedImage?.publicUrl ?? null;

  return (
    <>
      <section
        className="rawaj-detail-media"
        aria-label={text("صور الإعلان", "Listing images")}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="rawaj-detail-media__stage">
          {selectedUrl ? (
            <>
              <div
                className="rawaj-detail-media__skeleton"
                data-loaded={loadedUrl === selectedUrl}
                aria-hidden="true"
              />
              <img
                src={selectedUrl}
                alt={selectedImage?.altAr ?? title}
                decoding="async"
                fetchPriority="high"
                onLoad={() => setLoadedUrl(selectedUrl)}
                className="rawaj-detail-media__image"
              />
            </>
          ) : (
            <div className="rawaj-detail-media__placeholder">
              <PlaceholderArt type={placeholder} aspect="wide" />
            </div>
          )}

          <div className="rawaj-detail-media__shade" aria-hidden="true" />

          <div className="rawaj-detail-media__top-actions">
            <button type="button" onClick={onBack} aria-label={text("رجوع", "Back")}>
              <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
            </button>
            <div>
              <button
                type="button"
                onClick={onShare}
                aria-label={text("مشاركة الإعلان", "Share listing")}
              >
                <Share2 aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-pressed={favorite}
                aria-label={
                  favorite
                    ? text("إزالة من المفضلة", "Remove from favorites")
                    : text("حفظ في المفضلة", "Save to favorites")
                }
              >
                <Heart className={favorite ? "fill-current" : undefined} aria-hidden="true" />
              </button>
            </div>
          </div>

          {visibleImages.length > 0 ? (
            <div className="rawaj-detail-media__bottom-actions">
              <span aria-live="polite">
                {selectedIndex + 1} / {visibleImages.length}
              </span>
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                aria-label={text("فتح عارض الصور", "Open image viewer")}
              >
                <Maximize2 aria-hidden="true" />
                {text("عرض كامل", "Full view")}
              </button>
            </div>
          ) : null}

          {visibleImages.length > 1 ? (
            <>
              <button
                type="button"
                className="rawaj-detail-media__arrow rawaj-detail-media__arrow--previous"
                onClick={() => goTo(selectedIndex - 1)}
                aria-label={text("الصورة السابقة", "Previous image")}
              >
                <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="rawaj-detail-media__arrow rawaj-detail-media__arrow--next"
                onClick={() => goTo(selectedIndex + 1)}
                aria-label={text("الصورة التالية", "Next image")}
              >
                <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        {visibleImages.length > 1 ? (
          <div
            className="rawaj-detail-media__thumbnails"
            aria-label={text("مصغرات الصور", "Thumbnails")}
          >
            {visibleImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => goTo(index)}
                aria-pressed={selectedIndex === index}
                aria-label={text(`عرض الصورة ${index + 1}`, `View image ${index + 1}`)}
              >
                <img src={image.publicUrl ?? ""} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        ) : null}

        {imageError ? <p className="rawaj-detail-media__error">{imageError}</p> : null}
      </section>

      {viewerOpen ? (
        <Suspense fallback={null}>
          <ListingMediaViewer
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            images={visibleImages}
            title={title}
            selectedIndex={selectedIndex}
            onSelectedIndexChange={goTo}
            text={text}
          />
        </Suspense>
      ) : null}
    </>
  );
}
