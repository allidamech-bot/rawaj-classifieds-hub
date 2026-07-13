import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ListingImage } from "@/lib/classifieds-types";

interface ListingMediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ListingImage[];
  title: string;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  text: (ar: string, en: string) => string;
}

export default function ListingMediaViewer({
  open,
  onOpenChange,
  images,
  title,
  selectedIndex,
  onSelectedIndexChange,
  text,
}: ListingMediaViewerProps) {
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
                decoding="async"
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
                    <img src={image.publicUrl ?? ""} alt="" loading="lazy" decoding="async" />
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
