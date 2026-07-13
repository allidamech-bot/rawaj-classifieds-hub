import { useState } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { PlaceholderType } from "@/types";

interface ListingCardImageProps {
  src?: string | null;
  alt: string;
  placeholder: PlaceholderType;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}

export function ListingCardImage({
  src,
  alt,
  placeholder,
  loading = "lazy",
  fetchPriority,
}: ListingCardImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return <PlaceholderArt type={placeholder} aspect="standard" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      width={640}
      height={480}
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}
