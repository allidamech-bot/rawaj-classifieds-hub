import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Maximize2,
  Minus,
  Plus,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ListingImage } from "@/lib/classifieds-types";
import type { PlaceholderType } from "@/types";

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

      <ListingMediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        images={visibleImages}
        title={title}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={goTo}
        text={text}
      />
    </>
  );
}

function ListingMediaViewer({
  open,
  onOpenChange,
  images,
  title,
  selectedIndex,
  onSelectedIndexChange,
  text,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ListingImage[];
  title: string;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  text: (ar: string, en: string) => string;
}) {
  const [zoom, setZoom] = useState(1);
  const touchStartX = useRef<number | null>(null);
  const currentImage = images[selectedIndex] ?? images[0] ?? null;

  const goTo = useCallback(
    (index: number) => {
      if (images.length === 0) return;
      onSelectedIndexChange((index + images.length) % images.length);
      setZoom(1);
    },
    [images.length, onSelectedIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goTo(selectedIndex + 1);
      if (event.key === "ArrowRight") goTo(selectedIndex - 1);
      if (event.key === "+" || event.key === "=") setZoom((value) => Math.min(3, value + 0.5));
      if (event.key === "-") setZoom((value) => Math.max(1, value - 0.5));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goTo, open, selectedIndex]);

  useEffect(() => {
    if (!open) setZoom(1);
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rawaj-media-viewer__overlay" />
        <DialogPrimitive.Content
          className="rawaj-media-viewer"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchStartX.current === null) return;
            const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
            const delta = endX - touchStartX.current;
            touchStartX.current = null;
            if (zoom > 1 || Math.abs(delta) < 42) return;
            goTo(selectedIndex + (delta < 0 ? 1 : -1));
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {text("عارض صور الإعلان", "Listing image viewer")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>

          <header className="rawaj-media-viewer__header">
            <DialogPrimitive.Close aria-label={text("إغلاق العارض", "Close viewer")}>
              <X aria-hidden="true" />
            </DialogPrimitive.Close>
            <span>
              {selectedIndex + 1} / {images.length}
            </span>
            <div>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
                disabled={zoom === 1}
                aria-label={text("تصغير الصورة", "Zoom out")}
              >
                <Minus aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
                disabled={zoom === 3}
                aria-label={text("تكبير الصورة", "Zoom in")}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="rawaj-media-viewer__canvas">
            {currentImage?.publicUrl ? (
              <img
                src={currentImage.publicUrl}
                alt={currentImage.altAr ?? title}
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
              />
            ) : null}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                className="rawaj-media-viewer__previous"
                onClick={() => goTo(selectedIndex - 1)}
                aria-label={text("الصورة السابقة", "Previous image")}
              >
                <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="rawaj-media-viewer__next"
                onClick={() => goTo(selectedIndex + 1)}
                aria-label={text("الصورة التالية", "Next image")}
              >
                <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
              </button>
              <div className="rawaj-media-viewer__rail">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => goTo(index)}
                    aria-pressed={selectedIndex === index}
                  >
                    <img src={image.publicUrl ?? ""} alt="" decoding="async" />
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
