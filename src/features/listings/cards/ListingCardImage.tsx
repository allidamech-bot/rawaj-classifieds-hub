import { useState } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPlaceholder = !src || failedSrc === src;

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
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      width={width}
      height={height}
      draggable={false}
      onError={() => setFailedSrc(src)}
      className={cn("rawaj-listing-media rawaj-listing-media--image", className)}
    />
  );
}
