import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (failedSrc && failedSrc !== src) setFailedSrc(null);
  }, [failedSrc, src]);

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
      onError={() => setFailedSrc(src)}
    />
  );
}
