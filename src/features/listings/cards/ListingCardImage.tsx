import { useEffect, useRef, useState } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { PlaceholderType } from "@/types";

interface ListingCardImageProps {
  src?: string | null;
  alt: string;
  placeholder: PlaceholderType;
  placeholderAspect?: "square" | "standard" | "wide" | "tall";
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  width?: number;
  height?: number;
  className?: string;
}

export function ListingCardImage({
  src,
  alt,
  placeholder,
  placeholderAspect = "standard",
  loading = "lazy",
  fetchPriority,
  width = 640,
  height = 480,
  className,
}: ListingCardImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (loading === "eager" || !src) return;

    const image = imageRef.current;
    if (!image) return;

    const promoteIfNearViewport = () => {
      const bounds = image.getBoundingClientRect();
      const margin = window.innerHeight * 0.25;
      if (bounds.top <= window.innerHeight + margin && bounds.bottom >= -margin) {
        setNearViewport(true);
        return true;
      }
      return false;
    };

    if (promoteIfNearViewport() || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "25% 0px" },
    );
    observer.observe(image);

    return () => observer.disconnect();
  }, [loading, src]);

  if (!src || failedSrc === src) {
    return <PlaceholderArt type={placeholder} aspect={placeholderAspect} className={className} />;
  }

  const effectiveLoading = loading === "eager" || nearViewport ? "eager" : "lazy";
  const effectiveFetchPriority = fetchPriority ?? (nearViewport ? "high" : undefined);

  return (
    <img
      ref={imageRef}
      src={src}
      alt={alt}
      loading={effectiveLoading}
      fetchPriority={effectiveFetchPriority}
      decoding="async"
      width={width}
      height={height}
      draggable={false}
      onError={() => setFailedSrc(src)}
      className={className}
    />
  );
}
