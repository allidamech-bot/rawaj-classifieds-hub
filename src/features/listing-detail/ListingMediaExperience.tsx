import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Maximize2, Share2 } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { recordRecentListingView, syncAnonymousRecentListingViews } from "@/lib/classifieds-api";
import type { ListingImage } from "@/lib/classifieds-types";
import { useAuth } from "@/lib/use-auth";
import type { PlaceholderType } from "@/types";
import { useListingMediaState } from "./useListingMediaState";

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
  const auth = useAuth();
  const recordedViewKeyRef = useRef("");
  const {
    visibleImages,
    selectedIndex,
    selectedImage,
    selectedUrl,
    loadedUrl,
    setLoadedUrl,
    failedUrls,
    markImageFailed,
    viewerOpen,
    setViewerOpen,
    goTo,
    handleTouchStart,
    handleTouchEnd,
  } = useListingMediaState(images);
  const selectedImageFailed = selectedUrl ? failedUrls.has(selectedUrl) : false;

  useEffect(() => {
    if (auth.status === "loading" || typeof window === "undefined") return;

    const match = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/);
    const listingId = match?.[1] ? decodeURIComponent(match[1]).trim() : "";
    if (!listingId) return;

    const userId = auth.profile?.id ?? auth.user?.id ?? null;
    const recordKey = `${userId ?? "guest"}:${listingId}`;
    if (recordedViewKeyRef.current === recordKey) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (userId) await syncAnonymousRecentListingViews(userId);
        const result = await recordRecentListingView(userId, listingId);
        if (result.ok) recordedViewKeyRef.current = recordKey;
      })();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [auth.profile?.id, auth.status, auth.user?.id]);

  return (
    <>
      <section
        className="rawaj-detail-media"
        aria-label={text("صور الإعلان", "Listing images")}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="rawaj-detail-media__stage">
          {selectedUrl && !selectedImageFailed ? (
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
                onError={() => markImageFailed(selectedUrl)}
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
            {visibleImages.map((image, index) => {
              const imageUrl = image.publicUrl ?? "";
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-pressed={selectedIndex === index}
                  aria-label={text(`عرض الصورة ${index + 1}`, `View image ${index + 1}`)}
                >
                  {failedUrls.has(imageUrl) ? (
                    <PlaceholderArt type={placeholder} aspect="standard" />
                  ) : (
                    <img
                      src={imageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => markImageFailed(imageUrl)}
                    />
                  )}
                </button>
              );
            })}
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
            placeholder={placeholder}
            failedUrls={failedUrls}
            onImageError={markImageFailed}
            selectedIndex={selectedIndex}
            onSelectedIndexChange={goTo}
            text={text}
          />
        </Suspense>
      ) : null}
    </>
  );
}
