import { useEffect, useState } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { resolveAuthenticatedMediaUrl } from "@/lib/authenticated-media-url";
import type { PlaceholderType } from "@/types";
import { cn } from "@/lib/utils";

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
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(src ?? null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFailedSrc(null);
    setResolvedSrc(src ?? null);
    if (!src) return () => { active = false; };

    void resolveAuthenticatedMediaUrl(src).then((resolved) => {
      if (active) setResolvedSrc(resolved ?? src);
    });
    return () => {
      active = false;
    };
  }, [src]);

  const showPlaceholder = !resolvedSrc || failedSrc === resolvedSrc;

  if (showPlaceholder) {
    return (
      <PlaceholderArt
        type={placeholder}
        aspect={placeholderAspect}
        className={cn("rawaj-listing-media rawaj-listing-media--placeholder", className)}
      />
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      width={width}
      height={height}
      draggable={false}
      onError={() => setFailedSrc(resolvedSrc)}
      className={cn("rawaj-listing-media rawaj-listing-media--image", className)}
    />
  );
}
